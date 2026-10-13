import "server-only";
import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
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
import type { RoleName } from "@/lib/workflow";
import { ServiceError } from "./errors";

export class AdminForbiddenError extends ServiceError {
  constructor() {
    super("Only a system administrator can change these settings.", 403);
  }
}

function requireAdmin(user: CurrentUser) {
  if (!user.actor.roles.includes("SYS_ADMIN")) throw new AdminForbiddenError();
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
export async function assignRole(user: CurrentUser, userId: string, role: RoleName) {
  requireAdmin(user);
  UUID.parse(userId);
  await db.insert(roleAssignments).values({ userId, role }).onConflictDoNothing();
  await audit(user, "role", userId, { op: "assign", role });
}

export async function revokeRole(user: CurrentUser, userId: string, role: RoleName) {
  requireAdmin(user);
  UUID.parse(userId);
  if (role === "SYS_ADMIN") {
    const [{ n }] = await db.select({ n: count() }).from(roleAssignments).where(eq(roleAssignments.role, "SYS_ADMIN"));
    if (n <= 1) throw new ServiceError("You can't remove the last system admin.", 422);
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
  requireAdmin(user);
  const [bus, depts, buAdmins, roles, [{ failed }]] = await Promise.all([
    db.select().from(businessUnits).orderBy(asc(businessUnits.name)),
    db
      .select({ id: departments.id, name: departments.name, isActive: departments.isActive, businessUnitId: departments.businessUnitId, hodUserId: departments.hodUserId, hodName: users.name })
      .from(departments)
      .leftJoin(users, eq(departments.hodUserId, users.id))
      .orderBy(asc(departments.name)),
    db.select({ businessUnitId: businessUnitAdmins.businessUnitId, userId: users.id, name: users.name }).from(businessUnitAdmins).innerJoin(users, eq(businessUnitAdmins.userId, users.id)),
    db.select({ role: roleAssignments.role, userId: users.id, name: users.name, email: users.email }).from(roleAssignments).innerJoin(users, eq(roleAssignments.userId, users.id)).orderBy(asc(users.name)),
    db.select({ failed: count() }).from(notificationLogs).where(eq(notificationLogs.status, "FAILED")),
  ]);
  return { bus, depts, buAdmins, roles, failedNotifications: failed };
}

export async function listUsers(user: CurrentUser, q?: string) {
  requireAdmin(user);
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  return db
    .select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, isActive: users.isActive, departmentId: users.departmentId, entraDepartment: users.entraDepartment, lastLoginAt: users.lastLoginAt, departmentName: departments.name })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(like ? or(ilike(users.name, like), ilike(users.email, like)) : sql`true`)
    .orderBy(asc(users.name))
    .limit(200);
}

export async function userOptions() {
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name));
}

export async function listNotifications(user: CurrentUser) {
  requireAdmin(user);
  return db
    .select({ id: notificationLogs.id, event: notificationLogs.event, status: notificationLogs.status, attempts: notificationLogs.attempts, lastError: notificationLogs.lastError, createdAt: notificationLogs.createdAt, sentAt: notificationLogs.sentAt, refNo: trainingRequests.refNo, requestId: trainingRequests.id, payload: notificationLogs.payload })
    .from(notificationLogs)
    .leftJoin(trainingRequests, eq(notificationLogs.requestId, trainingRequests.id))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(100);
}

export async function listAudit(user: CurrentUser) {
  requireAdmin(user);
  return db
    .select({ id: adminAuditLogs.id, entity: adminAuditLogs.entity, entityId: adminAuditLogs.entityId, change: adminAuditLogs.change, createdAt: adminAuditLogs.createdAt, actorName: users.name })
    .from(adminAuditLogs)
    .innerJoin(users, eq(adminAuditLogs.actorId, users.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(200);
}
