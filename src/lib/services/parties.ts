import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import { businessUnitAdmins, departments, requestActions, roleAssignments, users } from "@/db/schema";
import { DEMO_EMAIL_DOMAIN, isDemoUser } from "@/lib/auth/roles";
import type { Parties, Person, RoleHolderCounts } from "@/lib/workflow";

const person = { id: users.id, name: users.name, email: users.email };

/**
 * Demo and real staff never mix: a demo request is routed, notified and counted
 * only among demo accounts, and a real request only among real staff.
 */
export type World = "demo" | "real";
export const worldOf = (email: string): World => (isDemoUser({ email }) ? "demo" : "real");
function inWorld(world: World | undefined): SQL {
  if (!world) return sql`true`;
  const demo = sql`lower(${users.email}) like ${"%" + DEMO_EMAIL_DOMAIN}`;
  return world === "demo" ? demo : sql`not (${demo})`;
}

async function roleHolders(tx: Tx, role: "LND" | "HR_HEAD", world?: World): Promise<Person[]> {
  return tx
    .select(person)
    .from(roleAssignments)
    .innerJoin(users, eq(roleAssignments.userId, users.id))
    .where(and(eq(roleAssignments.role, role), eq(users.isActive, true), inWorld(world)));
}

async function buAdminsOf(tx: Tx, businessUnitId: string | null, world?: World): Promise<Person[]> {
  if (!businessUnitId) return [];
  return tx
    .select(person)
    .from(businessUnitAdmins)
    .innerJoin(users, eq(businessUnitAdmins.userId, users.id))
    .where(and(eq(businessUnitAdmins.businessUnitId, businessUnitId), eq(users.isActive, true), inWorld(world)));
}

/** Everyone who approved the request since its latest submit/resubmit, in approval order. */
async function roundApproversOf(tx: Tx, requestId: string, world: World): Promise<Person[]> {
  const [lastSubmit] = await tx
    .select({ at: requestActions.createdAt })
    .from(requestActions)
    .where(and(eq(requestActions.requestId, requestId), inArray(requestActions.action, ["SUBMIT", "RESUBMIT"])))
    .orderBy(desc(requestActions.createdAt))
    .limit(1);
  if (!lastSubmit) return [];
  const rows = await tx
    .select(person)
    .from(requestActions)
    .innerJoin(users, eq(requestActions.actorId, users.id))
    .where(and(eq(requestActions.requestId, requestId), eq(requestActions.action, "APPROVE"), gt(requestActions.createdAt, lastSubmit.at), inWorld(world)))
    .orderBy(asc(requestActions.createdAt));
  const seen = new Set<string>();
  return rows.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Resolve everyone attached to a request from the mappings as they are right now. */
export async function loadParties(
  tx: Tx,
  req: { id: string; requesterId: string; departmentId: string | null; businessUnitId: string | null },
): Promise<Parties> {
  const [requester] = await tx.select(person).from(users).where(eq(users.id, req.requesterId));
  const world = worldOf(requester.email);
  let hod: Person | null = null;
  if (req.departmentId) {
    const [h] = await tx
      .select(person)
      .from(departments)
      .innerJoin(users, eq(departments.hodUserId, users.id))
      .where(and(eq(departments.id, req.departmentId), eq(users.isActive, true), inWorld(world)));
    hod = h ?? null;
  }
  // Sequential: these may run on one transaction connection, which can't take concurrent queries.
  const buAdmins = await buAdminsOf(tx, req.businessUnitId, world);
  const lnd = await roleHolders(tx, "LND", world);
  const hrHeads = await roleHolders(tx, "HR_HEAD", world);
  const roundApprovers = await roundApproversOf(tx, req.id, world);
  return { requester, hod, lnd, hrHeads, buAdmins, roundApprovers };
}

/** Active holders of each pooled role; `buAdmin` counts the given business unit's admins. */
export async function roleHolderCounts(tx: Tx, businessUnitId: string | null, world: World): Promise<RoleHolderCounts> {
  const lnd = await roleHolders(tx, "LND", world);
  const hr = await roleHolders(tx, "HR_HEAD", world);
  const bu = await buAdminsOf(tx, businessUnitId, world);
  return { lnd: lnd.length, hrHead: hr.length, buAdmin: bu.length };
}

/** Display names of the active HR Head(s), for trackers and hints. */
export async function hrHeadNames(tx: Tx, world: World): Promise<string | null> {
  const list = await roleHolders(tx, "HR_HEAD", world);
  return list.length ? list.map((p) => p.name).join(", ") : null;
}

/** Display names of the active BU Admin(s) of a business unit, for trackers and hints. */
export async function buAdminNames(tx: Tx, businessUnitId: string | null, world: World): Promise<string | null> {
  const list = await buAdminsOf(tx, businessUnitId, world);
  return list.length ? list.map((p) => p.name).join(", ") : null;
}
