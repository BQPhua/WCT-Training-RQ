import "server-only";
import { and, asc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, users } from "@/db/schema";
import { loadCurrentUser, type CurrentUser } from "@/lib/auth/load-user";
import { ServiceError } from "./errors";
import { DEMO_EMAIL_DOMAIN, isDemoUser, isSystemAdmin } from "@/lib/auth/roles";

/** Only seeded demo accounts can be viewed; never real staff. */
export { DEMO_EMAIL_DOMAIN };
const isDemo = (email: string) => isDemoUser({ email });
/** L&D members and System Admins (they only ever reach demo accounts). */
const isAdmin = (u: CurrentUser) => isSystemAdmin(u);

/** Human label for what a user can do, e.g. "Department HOD · HR Head". */
export function roleLabelOf(u: CurrentUser): string {
  const labels = [
    ...(u.actor.hodDepartmentIds.length ? ["Department HOD"] : []),
    ...(u.actor.buAdminBusinessUnitIds.length ? ["BU Admin"] : []),
    ...(u.actor.roles.includes("LND") ? ["L&D Team (System Admin)"] : []),
    ...(u.actor.roles.includes("HR_HEAD") ? ["HR Head"] : []),
    ...(u.actor.roles.includes("SYS_ADMIN") ? ["System Admin"] : []),
  ];
  return labels.length ? labels.join(" · ") : "Requester";
}

/**
 * The user the app should act as. A System Admin may view the app as an active
 * demo account; anything else (no admin role, real staff, deleted or inactive
 * target) quietly falls back to the signed-in user.
 */
export async function resolveViewAs(realUserId: string, viewAsUserId: string | undefined): Promise<CurrentUser | null> {
  const real = await loadCurrentUser(realUserId);
  if (!real || !viewAsUserId || viewAsUserId === real.id || !isAdmin(real)) return real;
  const target = await loadCurrentUser(viewAsUserId);
  if (!target || !isDemo(target.email)) return real;
  return { ...target, viewedBy: { id: real.id, name: real.name } };
}

export async function listDemoAccounts(): Promise<{ id: string; name: string; email: string; roleLabel: string }[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(like(users.email, `%${DEMO_EMAIL_DOMAIN}`), eq(users.isActive, true)))
    .orderBy(asc(users.name));
  const loaded = await Promise.all(rows.map((r) => loadCurrentUser(r.id)));
  return loaded
    .filter((u): u is CurrentUser => !!u)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, roleLabel: roleLabelOf(u) }));
}

/** Validates and audits a switch; the caller stores the id in the session. */
export async function startViewAs(real: CurrentUser, targetId: string): Promise<CurrentUser> {
  if (!isAdmin(real)) throw new ServiceError("Only the L&D Team or a System Admin can view the app as another user.", 403);
  const target = await loadCurrentUser(targetId);
  if (!target || !isDemo(target.email)) throw new ServiceError("Only demo accounts can be viewed.", 403);
  await db.insert(adminAuditLogs).values({ actorId: real.id, entity: "user", entityId: target.id, change: { op: "view-as-start", email: target.email } });
  return target;
}

export async function stopViewAs(real: CurrentUser): Promise<void> {
  await db.insert(adminAuditLogs).values({ actorId: real.id, entity: "user", entityId: real.id, change: { op: "view-as-stop" } });
}

/** Demo sign-in (sign-in page, behind DEMO_LOGIN): only active demo accounts, never real staff. */
export async function demoSignInTarget(userId: string): Promise<CurrentUser> {
  const target = await loadCurrentUser(userId);
  if (!target || !isDemo(target.email)) throw new ServiceError("Only demo accounts can be used here.", 403);
  return target;
}
