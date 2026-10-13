import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminAuditLogs, departments, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { ServiceError } from "./errors";

/**
 * A user may pick their own department once, only when Microsoft 365 didn't
 * map one. Later changes are admin-only (they re-route approvals).
 */
export async function setOwnDepartment(user: CurrentUser, departmentId: string) {
  const id = z.uuid().parse(departmentId);
  if (user.departmentId) throw new ServiceError("Your department is already set. Please contact HR to change it.", 403);
  const [d] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, id), eq(departments.isActive, true)));
  if (!d) throw new ServiceError("That department is not available.", 422);
  await db.update(users).set({ departmentId: d.id }).where(eq(users.id, user.id));
  await db.insert(adminAuditLogs).values({ actorId: user.id, entity: "user", entityId: user.id, change: { op: "self-select-department", departmentId: d.id } });
}
