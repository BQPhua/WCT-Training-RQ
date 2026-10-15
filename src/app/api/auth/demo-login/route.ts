import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/return-to";
import { env, isDemoLoginEnabled } from "@/lib/env";
import { isSameOrigin } from "@/lib/same-origin";
import { ServiceError } from "@/lib/services/errors";
import { demoSignInTarget, recordDemoSignIn } from "@/lib/services/view-as";

/**
 * Sign in as a demo account from the sign-in page (stakeholder trial).
 * 404 unless DEMO_LOGIN=true (or dev sign-in). Demo accounts only ever see demo requests.
 */
export async function POST(req: NextRequest) {
  if (!isDemoLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  if (!isSameOrigin(req.headers.get("origin"), env.APP_URL)) return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData();
  try {
    const user = await demoSignInTarget(String(form.get("userId") ?? ""));
    const session = await getSession();
    session.userId = user.id;
    delete session.viewAsUserId; // a new sign-in never inherits "view as"
    session.signedInAt = Date.now();
    await session.save();
    await recordDemoSignIn(user, req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip"));
    return NextResponse.redirect(`${env.APP_URL}${safeReturnTo(String(form.get("returnTo") ?? ""))}`, { status: 303 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.redirect(`${env.APP_URL}/signin?error=demo_user`, { status: 303 });
    throw e;
  }
}
