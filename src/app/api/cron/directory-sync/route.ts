import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorised } from "@/lib/cron-auth";
import { runDirectorySync } from "@/lib/services/directory-sync";
import { ServiceError } from "@/lib/services/errors";

/** Called nightly (01:40) by the server crontab to copy Microsoft 365 staff into Training RQ. */
export async function POST(req: NextRequest) {
  if (!cronAuthorised(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const run = await runDirectorySync({ trigger: "cron" });
    return NextResponse.json({ ok: run.ok, added: run.added, updated: run.updated, skipped: run.skipped, flagged: run.flagged, error: run.error }, { status: run.ok ? 200 : 502 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
