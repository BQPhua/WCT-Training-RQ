import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { trainingRequests as tr } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { DEMO_EMAIL_DOMAIN, isDemoUser } from "@/lib/auth/roles";
import { roleHolderCounts, worldOf } from "./parties";

const FALSE = sql`false`;

function isPrivileged(user: CurrentUser) {
  return user.actor.roles.some((r) => r === "LND" || r === "HR_HEAD" || r === "SYS_ADMIN");
}

/**
 * SQL filter: demo accounts only ever see requests raised by demo accounts, so the
 * stakeholder demo sign-in can never show real staff requests. `true` for everyone else.
 */
export function demoScopeWhere(user: CurrentUser): SQL {
  if (!isDemoUser(user)) return sql`true`;
  return sql`${tr.requesterId} in (select u.id from users u where lower(u.email) like ${"%" + DEMO_EMAIL_DOMAIN})`;
}

/** SQL filter: requests raised in the user's own world (demo accounts ↔ demo requests, real staff ↔ real requests). */
function sameWorldWhere(user: CurrentUser): SQL {
  if (isDemoUser(user)) return demoScopeWhere(user);
  return sql`${tr.requesterId} not in (select u.id from users u where lower(u.email) like ${"%" + DEMO_EMAIL_DOMAIN})`;
}

/** SQL filter: every request this user is allowed to see (mirrors workflow.canView). */
export function visibleRequestsWhere(user: CurrentUser): SQL {
  const { hodDepartmentIds, buAdminBusinessUnitIds } = user.actor;
  const others: SQL[] = [];
  if (isPrivileged(user)) others.push(sql`true`);
  if (hodDepartmentIds.length) others.push(inArray(tr.departmentId, hodDepartmentIds));
  if (buAdminBusinessUnitIds.length) others.push(inArray(tr.businessUnitId, buAdminBusinessUnitIds));
  return and(demoScopeWhere(user), or(eq(tr.requesterId, user.id), and(ne(tr.status, "DRAFT"), others.length ? or(...others) : FALSE)))!;
}

/** SQL filter: requests waiting for this user's action (approvals inbox + own returned items). */
export async function awaitingActionWhere(user: CurrentUser): Promise<SQL> {
  const { roles, hodDepartmentIds, buAdminBusinessUnitIds } = user.actor;
  const counts = await roleHolderCounts(db, null, worldOf(user.email));
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
  // Inbox in one world only: real approvers never get demo requests to decide, and vice versa.
  return and(sameWorldWhere(user), or(...parts))!;
}

/** Approvals only (excludes the user's own returned requests). */
export async function approvalsWhere(user: CurrentUser): Promise<SQL> {
  return and(await awaitingActionWhere(user), ne(tr.status, "RETURNED"))!;
}
