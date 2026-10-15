import "server-only";
import { and, asc, countDistinct, desc, eq, ilike, inArray, like as sqlLike, ne, not, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminAuditLogs,
  businessUnitAdmins,
  businessUnits,
  departments,
  notificationLogs,
  roleAssignments,
  trainingRequests,
  users,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { DEMO_EMAIL_DOMAIN, isDemoUser, isSystemAdmin } from "@/lib/auth/roles";
import type { RoleName } from "@/lib/workflow";
import { ServiceError } from "./errors";

export class AdminForbiddenError extends ServiceError {
  constructor() {
    super("Only a system administrator can change these settings.", 403);
  }
}

/** Reads: L&D and System Admins (demo ones included, with demo-only lists). */
function requireAdminRead(user: CurrentUser) {
  if (!isSystemAdmin(user)) throw new AdminForbiddenError();
}

/** Writes: L&D and System Admins, never demo accounts (the demo sign-in is open to stakeholders). */
function requireAdmin(user: CurrentUser) {
  requireAdminRead(user);
  if (isDemoUser(user)) throw new ServiceError("Demo accounts can look at settings but can't change them.", 403);
}

/** People a viewer may see in admin lists: demo viewers only ever see demo accounts. */
function peopleScope(user: CurrentUser): SQL {
  return isDemoUser(user) ? sqlLike(users.email, `%${DEMO_EMAIL_DOMAIN}`) : sql`true`;
}

async function audit(actor: CurrentUser, entity: string, entityId: string, change: Record<string, unknown>) {
  await db.insert(adminAuditLogs).values({ actorId: actor.id, entity, entityId, change });
}

const UUID = z.uuid();

// ---------- Business units ----------
const buSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,12}$/, "Code must be 2–12 letters/numbers"),
  name: z.string().trim().min(1).max(60),
  isActive: z.boolean(),
});

export async function upsertBusinessUnit(user: CurrentUser, input: z.input<typeof buSchema>) {
  requireAdmin(user);
  const d = buSchema.parse(input);
  const [dup] = await db
    .select({ id: businessUnits.id })
    .from(businessUnits)
    .where(and(eq(businessUnits.code, d.code), d.id ? ne(businessUnits.id, d.id) : sql`true`));
  if (dup) throw new ServiceError(`A business unit with code ${d.code} already exists.`, 422);
  const [row] = d.id
    ? await db.update(businessUnits).set({ code: d.code, name: d.name, isActive: d.isActive }).where(eq(businessUnits.id, d.id)).returning()
    : await db.insert(businessUnits).values({ code: d.code, name: d.name, isActive: d.isActive }).returning();
  await audit(user, "business_unit", row.id, { ...d, op: d.id ? "update" : "create" });
  return row;
}

export async function setBusinessUnitAdmins(user: CurrentUser, businessUnitId: string, userIds: string[]) {
  requireAdmin(user);
  UUID.parse(businessUnitId);
  const ids = [...new Set(userIds.map((u) => UUID.parse(u)))];
  await db.transaction(async (tx) => {
    await tx.delete(businessUnitAdmins).where(eq(businessUnitAdmins.businessUnitId, businessUnitId));
    if (ids.length) await tx.insert(businessUnitAdmins).values(ids.map((userId) => ({ businessUnitId, userId })));
  });
  await audit(user, "business_unit_admins", businessUnitId, { userIds: ids });
}

// ---------- Departments ----------
const deptSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  businessUnitId: z.uuid(),
  hodUserId: z.uuid().nullable(),
  isActive: z.boolean(),
});

export async function upsertDepartment(user: CurrentUser, input: z.input<typeof deptSchema>) {
  requireAdmin(user);
  const d = deptSchema.parse(input);
  const [dup] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(sql`lower(${departments.name}) = lower(${d.name})`, d.id ? ne(departments.id, d.id) : sql`true`));
  if (dup) throw new ServiceError(`A department named "${d.name}" already exists.`, 422);
  const values = { name: d.name, businessUnitId: d.businessUnitId, hodUserId: d.hodUserId, isActive: d.isActive };
  const [row] = d.id
    ? await db.update(departments).set(values).where(eq(departments.id, d.id)).returning()
    : await db.insert(departments).values(values).returning();
  await audit(user, "department", row.id, { ...values, op: d.id ? "update" : "create" });
  return row;
}

// ---------- Roles & users ----------
/**
 * Active, real (non-demo) people with full access (L&D Team or System Admin),
 * not counting the role assignments matched by `excluding`. Demo admins never count:
 * they disappear with the demo data.
 */
async function realAdminCount(excluding: SQL): Promise<number> {
  const [{ n }] = await db
    .select({ n: countDistinct(roleAssignments.userId) })
    .from(roleAssignments)
    .innerJoin(users, eq(roleAssignments.userId, users.id))
    .where(
      and(
        inArray(roleAssignments.role, ["SYS_ADMIN", "LND"]),
        eq(users.isActive, true),
        sql`lower(${users.email}) not like ${"%" + DEMO_EMAIL_DOMAIN}`,
        not(excluding),
      ),
    );
  return n;
}

export async function assignRole(user: CurrentUser, userId: string, role: RoleName) {
  requireAdmin(user);
  UUID.parse(userId);
  await db.insert(roleAssignments).values({ userId, role }).onConflictDoNothing();
  await audit(user, "role", userId, { op: "assign", role });
}

export async function revokeRole(user: CurrentUser, userId: string, role: RoleName) {
  requireAdmin(user);
  UUID.parse(userId);
  if (role === "SYS_ADMIN" || role === "LND") {
    // L&D members and System Admins both have full access; keep at least one of them.
    const n = await realAdminCount(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, role))!);
    if (n < 1) throw new ServiceError("You can't remove the last system admin (L&D Team or System Admin).", 422);
  }
  await db.delete(roleAssignments).where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, role)));
  await audit(user, "role", userId, { op: "revoke", role });
}

const userPatch = z.object({ departmentId: z.uuid().nullable().optional(), isActive: z.boolean().optional() });

export async function updateUser(user: CurrentUser, userId: string, patch: z.input<typeof userPatch>) {
  requireAdmin(user);
  UUID.parse(userId);
  const p = userPatch.parse(patch);
  if (userId === user.id && p.isActive === false) throw new ServiceError("You can't deactivate yourself.", 422);
  if (p.isActive === false && (await realAdminCount(eq(roleAssignments.userId, userId))) < 1) {
    throw new ServiceError("You can't deactivate the last system admin (L&D Team or System Admin).", 422);
  }
  await db.update(users).set(p).where(eq(users.id, userId));
  await audit(user, "user", userId, p);
}

/** Pre-create a user (before their first sign-in) so they can be made HOD / role holder. */
export async function createUser(user: CurrentUser, input: { email: string; name: string; departmentId?: string | null }) {
  requireAdmin(user);
  const d = z.object({ email: z.email().toLowerCase(), name: z.string().trim().min(2).max(120), departmentId: z.uuid().nullable().optional() }).parse(input);
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email));
  if (exists) throw new ServiceError("A user with that email already exists.", 422);
  const [row] = await db.insert(users).values({ email: d.email, name: d.name, departmentId: d.departmentId ?? null }).returning();
  await audit(user, "user", row.id, { op: "create", email: d.email });
  return row;
}

// ---------- Reads for admin pages ----------
export async function adminOverview(user: CurrentUser) {
  requireAdminRead(user);
  const people = peopleScope(user);
  const [bus, depts, buAdmins, roles, [{ failed }]] = await Promise.all([
    db.select().from(businessUnits).orderBy(asc(businessUnits.name)),
    db
      .select({ id: departments.id, name: departments.name, isActive: departments.isActive, businessUnitId: departments.businessUnitId, hodUserId: departments.hodUserId, hodName: users.name })
      .from(departments)
      .leftJoin(users, and(eq(departments.hodUserId, users.id), people))
      .where(
        // Demo viewers see the demo organisation only: departments with a demo HOD or demo members.
        isDemoUser(user)
          ? sql`exists (select 1 from users u where (u.id = ${departments.hodUserId} or u.department_id = ${departments.id}) and lower(u.email) like ${"%" + DEMO_EMAIL_DOMAIN})`
          : sql`true`,
      )
      .orderBy(asc(departments.name)),
    db.select({ businessUnitId: businessUnitAdmins.businessUnitId, userId: users.id, name: users.name }).from(businessUnitAdmins).innerJoin(users, and(eq(businessUnitAdmins.userId, users.id), people)),
    db.select({ role: roleAssignments.role, userId: users.id, name: users.name, email: users.email }).from(roleAssignments).innerJoin(users, and(eq(roleAssignments.userId, users.id), people)).orderBy(asc(users.name)),
    db
      .select({ failed: countDistinct(notificationLogs.id) })
      .from(notificationLogs)
      .leftJoin(trainingRequests, eq(notificationLogs.requestId, trainingRequests.id))
      .where(and(eq(notificationLogs.status, "FAILED"), notificationScope(user))),
  ]);
  // Never hand a real HOD's id to a demo viewer's client components.
  const shownDepts = isDemoUser(user) ? depts.map((d) => (d.hodName ? d : { ...d, hodUserId: null })) : depts;
  return { bus, depts: shownDepts, buAdmins, roles, failedNotifications: failed };
}

export async function listUsers(user: CurrentUser, q?: string) {
  requireAdminRead(user);
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  return db
    .select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, isActive: users.isActive, departmentId: users.departmentId, entraDepartment: users.entraDepartment, lastLoginAt: users.lastLoginAt, departmentName: departments.name })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(peopleScope(user), like ? or(ilike(users.name, like), ilike(users.email, like)) : sql`true`))
    .orderBy(asc(users.name))
    .limit(200);
}

export async function userOptions(user: CurrentUser) {
  requireAdminRead(user);
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.isActive, true), peopleScope(user)))
    .orderBy(asc(users.name));
}

/** Demo viewers only see notifications about demo requests. */
function notificationScope(user: CurrentUser): SQL {
  if (!isDemoUser(user)) return sql`true`;
  return sql`${trainingRequests.requesterId} in (select id from users where email like ${"%" + DEMO_EMAIL_DOMAIN})`;
}

export async function listNotifications(user: CurrentUser) {
  requireAdminRead(user);
  const rows = await db
    .select({ id: notificationLogs.id, event: notificationLogs.event, status: notificationLogs.status, attempts: notificationLogs.attempts, lastError: notificationLogs.lastError, createdAt: notificationLogs.createdAt, sentAt: notificationLogs.sentAt, refNo: trainingRequests.refNo, requestId: trainingRequests.id, payload: notificationLogs.payload })
    .from(notificationLogs)
    .leftJoin(trainingRequests, eq(notificationLogs.requestId, trainingRequests.id))
    .where(notificationScope(user))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(100);
  if (!isDemoUser(user)) return rows;
  // Demo viewers only ever see demo addresses, even on older log rows.
  const demoOnly = (list: unknown) => (Array.isArray(list) ? list.filter((e) => typeof e === "string" && isDemoUser({ email: e })) : []);
  return rows.map((r) => {
    const p = (r.payload ?? {}) as { to?: unknown; cc?: unknown };
    return { ...r, payload: { ...p, to: demoOnly(p.to), cc: demoOnly(p.cc) } };
  });
}

