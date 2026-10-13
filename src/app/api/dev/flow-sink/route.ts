import { NextResponse } from "next/server";
import { isDevLoginEnabled } from "@/lib/env";

/**
 * DEVELOPMENT/E2E ONLY: stands in for the Power Automate flow so notifications
 * can be inspected locally. Returns 404 in production.
 */
const store = globalThis as unknown as { __flowSink?: unknown[] };

export async function POST(req: Request) {
  if (!isDevLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  store.__flowSink ??= [];
  store.__flowSink.push(await req.json());
  store.__flowSink = store.__flowSink.slice(-200);
  return new NextResponse(null, { status: 202 });
}

export async function GET() {
  if (!isDevLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(store.__flowSink ?? []);
}
