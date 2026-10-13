import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { businessUnitAdmins, departments, roleAssignments, users } from "@/db/schema";
import type { Parties, Person, RoleHolderCounts } from "@/lib/workflow";

const person = { id: users.id, name: users.name, email: users.email };

async function roleHolders(tx: Tx, role: "LND" | "HR_HEAD"): Promise<Person[]> {
  return tx
    .select(person)
    .from(roleAssignments)
    .innerJoin(users, eq(roleAssignments.userId, users.id))
    .where(and(eq(roleAssignments.role, role), eq(users.isActive, true)));
}

/** Resolve everyone attached to a request from the mappings as they are right now. */
export async function loadParties(
  tx: Tx,
  req: { requesterId: string; departmentId: string | null; businessUnitId: string | null },
): Promise<Parties> {
  const [requester] = await tx.select(person).from(users).where(eq(users.id, req.requesterId));
  let hod: Person | null = null;
  if (req.departmentId) {
    const [h] = await tx
      .select(person)
      .from(departments)
      .innerJoin(users, eq(departments.hodUserId, users.id))
      .where(and(eq(departments.id, req.departmentId), eq(users.isActive, true)));
    hod = h ?? null;
  }
  const buAdmins = req.businessUnitId
    ? await tx
        .select(person)
        .from(businessUnitAdmins)
        .innerJoin(users, eq(businessUnitAdmins.userId, users.id))
        .where(and(eq(businessUnitAdmins.businessUnitId, req.businessUnitId), eq(users.isActive, true)))
    : [];
  const [lnd, hrHeads] = await Promise.all([roleHolders(tx, "LND"), roleHolders(tx, "HR_HEAD")]);
  return { requester, hod, lnd, hrHeads, buAdmins };
}

export async function roleHolderCounts(tx: Tx): Promise<RoleHolderCounts> {
  const [lnd, hr] = await Promise.all([roleHolders(tx, "LND"), roleHolders(tx, "HR_HEAD")]);
  return { lnd: lnd.length, hrHead: hr.length };
}

/** Display names of the active HR Head(s), for trackers and hints. */
export async function hrHeadNames(tx: Tx): Promise<string | null> {
  const list = await roleHolders(tx, "HR_HEAD");
  return list.length ? list.map((p) => p.name).join(", ") : null;
}
