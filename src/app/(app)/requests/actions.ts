"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth/current-user";
import { toActionError, type ActionResult } from "@/lib/action-result";
import {
  addComment,
  cloneRequest,
  createDraft,
  performAction,
  updateContent,
  updateLndFields,
} from "@/lib/services/requests";
import { actionSchema, type DraftInput, type LndFieldsInput } from "@/lib/validation/request";

type SaveInput = { id?: string; version?: number; data: DraftInput };

async function save(input: SaveInput) {
  const user = await requireApiUser();
  if (input.id) {
    const { version } = await updateContent(user, input.id, input.version!, input.data);
    return { id: input.id, version };
  }
  const { id } = await createDraft(user, input.data);
  return { id, version: 1 };
}

export async function saveDraftAction(input: SaveInput): Promise<ActionResult<{ id: string; version: number }>> {
  try {
    const r = await save(input);
    revalidatePath("/my-requests");
    return { ok: true, ...r };
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitRequestAction(input: SaveInput & { resubmit: boolean; remark?: string }): Promise<ActionResult<{ id: string }>> {
  let id: string;
  try {
    const user = await requireApiUser();
    const saved = await save(input);
    id = saved.id;
    await performAction(user, { requestId: id, version: saved.version, type: input.resubmit ? "RESUBMIT" : "SUBMIT", remark: input.remark });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  redirect(`/requests/${id}?submitted=1`);
}

export async function setMyDepartmentAction(departmentId: string): Promise<ActionResult> {
  try {
    const user = await requireApiUser();
    const [d] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId));
    if (!d) return { ok: false, error: "Department not found." };
    await db.update(users).set({ departmentId: d.id }).where(eq(users.id, user.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function workflowAction(raw: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await requireApiUser();
    const input = actionSchema.parse(raw);
    const r = await performAction(user, input);
    revalidatePath("/", "layout");
    return { ok: true, status: r.status };
  } catch (e) {
    revalidatePath("/", "layout");
    return toActionError(e);
  }
}

export async function updateLndFieldsAction(id: string, version: number, data: LndFieldsInput): Promise<ActionResult> {
  try {
    const user = await requireApiUser();
    await updateLndFields(user, id, version, data);
    revalidatePath(`/requests/${id}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addCommentAction(id: string, body: string): Promise<ActionResult> {
  try {
    const user = await requireApiUser();
    await addComment(user, id, body);
    revalidatePath(`/requests/${id}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cloneAction(id: string): Promise<ActionResult> {
  let newId: string;
  try {
    const user = await requireApiUser();
    newId = (await cloneRequest(user, id)).id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/requests/${newId}/edit?cloned=1`);
}
