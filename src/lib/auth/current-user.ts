import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signinPath } from "./return-to";
import { getSession, isSessionExpired } from "./session";
import { loadCurrentUser, type CurrentUser } from "./load-user";
import type { RoleName } from "@/lib/workflow";

export type { CurrentUser };

/** Current signed-in user (memoised per request), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.userId || isSessionExpired(session)) return null;
  return loadCurrentUser(session.userId);
});

/** For pages: redirect to sign-in when not authenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signinPath((await headers()).get("x-trq-path")));
  return user;
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** For route handlers / server actions: throw instead of redirecting. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Please sign in again.");
  return user;
}

export function hasRole(user: CurrentUser, role: RoleName): boolean {
  return user.actor.roles.includes(role);
}

export async function requireRole(role: RoleName): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, role)) redirect("/dashboard?denied=1");
  return user;
}
