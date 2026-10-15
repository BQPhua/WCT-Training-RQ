import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isDemoUser } from "@/lib/auth/roles";
import { directory } from "@/lib/services/directory-instance";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isDemoUser(user)) return NextResponse.json([]); // demo accounts never search real staff
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await directory.search(q));
}
