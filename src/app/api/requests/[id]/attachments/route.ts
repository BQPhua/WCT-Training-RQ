import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { saveAttachment } from "@/lib/services/attachments";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/requests/[id]/attachments">) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    const kind = form.get("kind") === "NAME_LIST" ? "NAME_LIST" : "SUPPORTING";
    const att = await saveAttachment(user, id, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, kind);
    return NextResponse.json({ id: att.id, kind: att.kind, originalName: att.originalName, sizeBytes: att.sizeBytes, mimeType: att.mimeType });
  } catch (e) {
    return apiError(e);
  }
}
