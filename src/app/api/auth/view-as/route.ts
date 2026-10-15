import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, getSignedInUser } from "@/lib/auth/current-user";
import { getSession } from "@/lib/auth/session";
import { apiError } from "@/lib/api";
import { startViewAs, stopViewAs } from "@/lib/services/view-as";

const body = z.union([z.object({ userId: z.uuid() }), z.object({ stop: z.literal(true) })]);

/** Start or stop viewing the app as a demo account (System Admin only). JSON only, so forms on other sites can't post here. */
export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
    const real = await getSignedInUser();
    if (!real) throw new AuthError(401, "Please sign in again.");
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const input = parsed.data;
    const session = await getSession();
    if ("stop" in input) {
      if (session.viewAsUserId) await stopViewAs(real);
      delete session.viewAsUserId;
    } else {
      const target = await startViewAs(real, input.userId);
      session.viewAsUserId = target.id;
    }
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
