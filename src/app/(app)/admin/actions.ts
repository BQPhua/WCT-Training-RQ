"use server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/lib/auth/current-user";
import { isDemoUser, isSystemAdmin } from "@/lib/auth/roles";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { assignRole, createUser, revokeRole, setBusinessUnitAdmins, syncDirectoryNow, updateBusinessUnitFlow, updateUser, upsertBusinessUnit, upsertDepartment, type StepKey } from "@/lib/services/admin";
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
    if (!isSystemAdmin(user) || isDemoUser(user)) throw new Error("forbidden");
    await deliver(logId);
  });
}

export async function saveBusinessUnitFlowAction(
  buId: string,
  input: { requiresBuAdmin: boolean; requiresHrApproval: boolean; stepNotes: Partial<Record<StepKey, string>> },
) {
  return run(async () => updateBusinessUnitFlow(await requireApiUser(), buId, input));
}

/** "Sync now": copy Microsoft 365 staff in. A finished-but-failed run is reported as an error. */
export async function syncNowAction(): Promise<ActionResult<{ summary: string }>> {
  try {
    const run = await syncDirectoryNow(await requireApiUser());
    revalidatePath("/admin", "layout");
    if (!run.ok) return { ok: false, error: `Sync failed: ${run.error ?? "unknown error"}` };
    return { ok: true, summary: `Synced: ${run.added} added, ${run.updated} updated` };
  } catch (e) {
    return toActionError(e);
  }
}
