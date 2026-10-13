import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/current-user";
import { ServiceError } from "@/lib/services/errors";
import { WorkflowError } from "@/lib/workflow";

/** Map known errors to safe JSON responses; log the rest. */
export function apiError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof WorkflowError) return NextResponse.json({ error: e.message }, { status: e.code === "FORBIDDEN" ? 403 : 422 });
  const id = crypto.randomUUID().slice(0, 8);
  console.error(`[api] error ${id}`, e);
  return NextResponse.json({ error: `Something went wrong (ref ${id}).` }, { status: 500 });
}
