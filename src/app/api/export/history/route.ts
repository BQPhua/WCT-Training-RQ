import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { exportHistoryXlsx, parseHistoryFilters } from "@/lib/services/history";

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const f = parseHistoryFilters(Object.fromEntries(req.nextUrl.searchParams));
    const buf = await exportHistoryXlsx(user, f);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="training-rq-history-${date}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
