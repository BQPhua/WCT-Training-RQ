import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the requested path to server components so an unauthenticated visit
 * (e.g. an approver clicking "Open request" in an email) returns to the same
 * page after Microsoft sign-in. Authentication itself is enforced in layouts,
 * route handlers and server actions.
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-trq-path", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
