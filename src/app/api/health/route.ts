import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Liveness + DB check used by the deploy script and monitoring. No secrets or details exposed. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
