import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { pdfDataFromDetail } from "@/lib/pdf/from-detail";
import { renderRequestPdf } from "@/lib/pdf/render";
import { contentDisposition } from "@/lib/services/attachment-rules";
import { getRequestForUser } from "@/lib/services/requests";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/requests/[id]/pdf">) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const detail = await getRequestForUser(user, id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pdf = await renderRequestPdf(pdfDataFromDetail(detail));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition("inline", `${detail.request.refNo ?? "draft"}.pdf`),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
