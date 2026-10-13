import "server-only";
import { AuthError } from "@/lib/auth/current-user";
import { ServiceError, ValidationFailedError } from "@/lib/services/errors";
import { WorkflowError } from "@/lib/workflow";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Convert thrown errors into a serialisable result for server actions. */
export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ValidationFailedError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof ServiceError || e instanceof WorkflowError || e instanceof AuthError) return { ok: false, error: e.message };
  if (e && typeof e === "object" && "issues" in e) return { ok: false, error: "Please check the highlighted fields." };
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[action] error ${ref}`, e);
  return { ok: false, error: `Something went wrong (ref ${ref}). Please try again.` };
}
