import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { contentDisposition } from "@/lib/services/attachment-rules";
import { deleteAttachment, readAttachment } from "@/lib/services/attachments";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/attachments/[attachmentId]">) {
  try {
    const user = await requireApiUser();
    const { attachmentId } = await ctx.params;
    const found = await readAttachment(user, attachmentId);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(found.data), {
      headers: {
        "Content-Type": found.meta.mimeType,
        "Content-Disposition": contentDisposition("attachment", found.meta.originalName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/attachments/[attachmentId]">) {
  try {
    const user = await requireApiUser();
    const { attachmentId } = await ctx.params;
    await deleteAttachment(user, attachmentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
