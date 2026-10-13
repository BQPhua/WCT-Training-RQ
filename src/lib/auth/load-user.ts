import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businessUnitAdmins,
  businessUnits,
  departments,
  roleAssignments,
  users,
  type BusinessUnit,
  type Department,
  type User,
} from "@/db/schema";
import type { Actor, RoleName } from "@/lib/workflow";

export type CurrentUser = User & {
  actor: Actor;
  department: Department | null;
  businessUnit: BusinessUnit | null;
};

/** Loads a user plus everything the workflow needs to authorise them. */
export async function loadCurrentUser(userId: string): Promise<CurrentUser | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.isActive) return null;

  const [roles, hodDepts, buAdmin, dept] = await Promise.all([
    db.select({ role: roleAssignments.role }).from(roleAssignments).where(eq(roleAssignments.userId, userId)),
    db.select({ id: departments.id }).from(departments).where(eq(departments.hodUserId, userId)),
    db.select({ id: businessUnitAdmins.businessUnitId }).from(businessUnitAdmins).where(eq(businessUnitAdmins.userId, userId)),
    user.departmentId
      ? db
          .select({ department: departments, businessUnit: businessUnits })
          .from(departments)
          .innerJoin(businessUnits, eq(departments.businessUnitId, businessUnits.id))
          .where(eq(departments.id, user.departmentId))
      : Promise.resolve([]),
  ]);

  return {
    ...user,
    department: dept[0]?.department ?? null,
    businessUnit: dept[0]?.businessUnit ?? null,
    actor: {
      id: user.id,
      roles: roles.map((r) => r.role as RoleName).sort(),
      hodDepartmentIds: hodDepts.map((d) => d.id),
      buAdminBusinessUnitIds: buAdmin.map((b) => b.id),
    },
  };
}
