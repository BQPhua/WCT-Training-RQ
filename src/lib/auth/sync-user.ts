import "server-only";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, roleAssignments, users, type User } from "@/db/schema";
import { env } from "@/lib/env";

export interface EntraProfile {
  oid: string;
  email: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
}

export class DeactivatedUserError extends Error {
  constructor() {
    super("Your account has been deactivated in the Training RQ system. Please contact HR.");
  }
}

/**
 * Upsert the local user from the Microsoft profile on every sign-in.
 * - Matches existing rows by Entra object id, then by email (pre-created users).
 * - Department is matched case-insensitively by name; an unmatched or empty
 *   Entra department never clears a department already set.
 * - Bootstrap admin emails get SYS_ADMIN.
 */
export async function syncUserFromProfile(profile: EntraProfile): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const entraDept = profile.department?.trim() || null;

  let matchedDeptId: string | null = null;
  if (entraDept) {
    const [d] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(sql`lower(${departments.name}) = lower(${entraDept})`);
    matchedDeptId = d?.id ?? null;
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.entraOid, profile.oid), eq(users.email, email)));

  let user: User;
  if (existing) {
    if (!existing.isActive) throw new DeactivatedUserError();
    [user] = await db
      .update(users)
      .set({
        entraOid: profile.oid,
        email,
        name: profile.name,
        jobTitle: profile.jobTitle ?? existing.jobTitle,
        entraDepartment: entraDept,
        departmentId: matchedDeptId ?? existing.departmentId,
        lastLoginAt: new Date(),
        // Signing in with Microsoft proves the account is in Microsoft 365 (so it is never flagged as a leaver).
        directorySeenAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
  } else {
    [user] = await db
      .insert(users)
      .values({
        entraOid: profile.oid,
        email,
        name: profile.name,
        jobTitle: profile.jobTitle ?? null,
        entraDepartment: entraDept,
        departmentId: matchedDeptId,
        lastLoginAt: new Date(),
        directorySeenAt: new Date(),
      })
      .returning();
  }

  if (env.BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    await db.insert(roleAssignments).values({ userId: user.id, role: "SYS_ADMIN" }).onConflictDoNothing();
  }
  return user;
}
