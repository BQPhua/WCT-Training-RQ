import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { pdfDataFromDetail } from "@/lib/pdf/from-detail";
import { contentDisposition } from "@/lib/services/attachment-rules";
import { buildRequestXlsx } from "@/lib/services/request-xlsx";
import { getRequestForUser } from "@/lib/services/requests";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/requests/[id]/xlsx">) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const detail = await getRequestForUser(user, id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const xlsx = await buildRequestXlsx(pdfDataFromDetail(detail));
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition("attachment", `${detail.request.refNo ?? "draft"}.xlsx`),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
