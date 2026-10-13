import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/return-to";
import { env, isDevLoginEnabled } from "@/lib/env";

/** Development / E2E only. Returns 404 in production regardless of env flags. */
export async function POST(req: NextRequest) {
  if (!isDevLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const email = String(form.get("email") ?? "").toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.isActive) return NextResponse.redirect(`${env.APP_URL}/signin?error=dev_user`, { status: 303 });
  const session = await getSession();
  session.userId = user.id;
  session.signedInAt = Date.now();
  await session.save();
  return NextResponse.redirect(`${env.APP_URL}${safeReturnTo(String(form.get("returnTo") ?? ""))}`, { status: 303 });
}
