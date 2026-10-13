import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { retryFailed } from "@/lib/notify/send";

function authorised(header: string | null): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called every 5 minutes by the server crontab to retry failed notifications. */
export async function POST(req: NextRequest) {
  if (!authorised(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const retried = await retryFailed();
  return NextResponse.json({ retried });
}
