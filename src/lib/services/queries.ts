import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { trainingRequests as tr } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { roleHolderCounts } from "./parties";

const FALSE = sql`false`;

function isPrivileged(user: CurrentUser) {
  return user.actor.roles.some((r) => r === "LND" || r === "HR_HEAD" || r === "SYS_ADMIN");
}

/** SQL filter: every request this user is allowed to see (mirrors workflow.canView). */
export function visibleRequestsWhere(user: CurrentUser): SQL {
  const { hodDepartmentIds, buAdminBusinessUnitIds } = user.actor;
  const others: SQL[] = [];
  if (isPrivileged(user)) others.push(sql`true`);
  if (hodDepartmentIds.length) others.push(inArray(tr.departmentId, hodDepartmentIds));
  if (buAdminBusinessUnitIds.length) others.push(inArray(tr.businessUnitId, buAdminBusinessUnitIds));
  return or(eq(tr.requesterId, user.id), and(ne(tr.status, "DRAFT"), others.length ? or(...others) : FALSE))!;
}

/** SQL filter: requests waiting for this user's action (approvals inbox + own returned items). */
export async function awaitingActionWhere(user: CurrentUser): Promise<SQL> {
  const { roles, hodDepartmentIds, buAdminBusinessUnitIds } = user.actor;
  const counts = await roleHolderCounts(db);
  const parts: SQL[] = [and(eq(tr.status, "RETURNED"), eq(tr.requesterId, user.id))!];
  if (hodDepartmentIds.length) parts.push(and(eq(tr.status, "PENDING_HOD"), inArray(tr.departmentId, hodDepartmentIds))!);
  if (buAdminBusinessUnitIds.length) {
    // Own requests are left out here; a sole BU Admin can still act on them from My requests.
    parts.push(and(eq(tr.status, "PENDING_BU"), inArray(tr.businessUnitId, buAdminBusinessUnitIds), ne(tr.requesterId, user.id))!);
  }
  if (roles.includes("LND")) {
    parts.push(and(eq(tr.status, "PENDING_LND"), counts.lnd <= 1 ? sql`true` : ne(tr.requesterId, user.id))!);
  }
  if (roles.includes("HR_HEAD")) {
    parts.push(and(eq(tr.status, "PENDING_HR"), counts.hrHead <= 1 ? sql`true` : ne(tr.requesterId, user.id))!);
  }
  return or(...parts)!;
}

/** Approvals only (excludes the user's own returned requests). */
export async function approvalsWhere(user: CurrentUser): Promise<SQL> {
  return and(await awaitingActionWhere(user), ne(tr.status, "RETURNED"))!;
}
