import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(`${env.APP_URL}/signin?signedout=1`, { status: 303 });
}
