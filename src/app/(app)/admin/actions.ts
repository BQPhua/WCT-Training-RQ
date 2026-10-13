"use server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth/current-user";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { assignRole, createUser, revokeRole, setBusinessUnitAdmins, updateUser, upsertBusinessUnit, upsertDepartment } from "@/lib/services/admin";
import { deliver } from "@/lib/notify/send";
import type { RoleName } from "@/lib/workflow";

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveBusinessUnitAction(input: { id?: string; code: string; name: string; isActive: boolean }) {
  return run(async () => upsertBusinessUnit(await requireApiUser(), input));
}
export async function saveBuAdminsAction(buId: string, userIds: string[]) {
  return run(async () => setBusinessUnitAdmins(await requireApiUser(), buId, userIds));
}
export async function saveDepartmentAction(input: { id?: string; name: string; businessUnitId: string; hodUserId: string | null; isActive: boolean }) {
  return run(async () => upsertDepartment(await requireApiUser(), input));
}
export async function assignRoleAction(userId: string, role: RoleName) {
  return run(async () => assignRole(await requireApiUser(), userId, role));
}
export async function revokeRoleAction(userId: string, role: RoleName) {
  return run(async () => revokeRole(await requireApiUser(), userId, role));
}
export async function updateUserAction(userId: string, patch: { departmentId?: string | null; isActive?: boolean }) {
  return run(async () => updateUser(await requireApiUser(), userId, patch));
}
export async function createUserAction(input: { email: string; name: string; departmentId?: string | null }) {
  return run(async () => createUser(await requireApiUser(), input));
}
export async function retryNotificationAction(logId: string) {
  return run(async () => {
    const user = await requireApiUser();
    if (!user.actor.roles.includes("SYS_ADMIN")) throw new Error("forbidden");
    await deliver(logId);
  });
}
