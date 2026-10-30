import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorised } from "@/lib/cron-auth";
import { retryFailed } from "@/lib/notify/send";

/** Called every 5 minutes by the server crontab to retry failed notifications. */
export async function POST(req: NextRequest) {
  if (!cronAuthorised(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const retried = await retryFailed();
  return NextResponse.json({ retried });
}
