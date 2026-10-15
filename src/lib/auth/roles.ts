import type { RoleName } from "@/lib/workflow";

/** Seeded demo accounts live on this domain; never real staff. */
export const DEMO_EMAIL_DOMAIN = "@demo.wct.my";

/** Demo accounts only ever see and act on requests raised by demo accounts. */
export function isDemoUser(user: { email: string }): boolean {
  return user.email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

/** The L&D team manages every training requisition, so it has full System Admin access. */
export function isSystemAdmin(user: { actor: { roles: readonly RoleName[] } }): boolean {
  return user.actor.roles.some((r) => r === "SYS_ADMIN" || r === "LND");
}
