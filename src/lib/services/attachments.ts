import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, trainingRequests, users, type Attachment } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { isDemoUser } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { canEditContent, canView, type RequestRef } from "@/lib/workflow";
import { extensionOf, mimeTypeFor, sanitizeFilename, sniffOk, validateUpload, type AttachmentKind } from "./attachment-rules";
import { NotFoundError, ServiceError } from "./errors";

function storagePath(storedName: string) {
  // storedName is always `${uuid}.${ext}` generated here — never user input.
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(storedName)) throw new Error("Invalid stored name");
  return path.resolve(env.UPLOAD_DIR, storedName);
}

/** The request as `user` may see it: null when missing, not visible, or a real request seen by a demo account. */
async function loadRequestRef(user: CurrentUser, id: string): Promise<RequestRef | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ r: trainingRequests, requesterEmail: users.email })
    .from(trainingRequests)
    .innerJoin(users, eq(trainingRequests.requesterId, users.id))
    .where(eq(trainingRequests.id, id));
  if (!row || !canView(row.r, user.actor)) return null;
  if (isDemoUser(user) && !isDemoUser({ email: row.requesterEmail })) return null;
  return row.r;
}

export async function saveAttachment(
  user: CurrentUser,
  requestId: string,
  file: { name: string; type: string; bytes: Uint8Array },
  kind: AttachmentKind = "SUPPORTING",
): Promise<Attachment> {
  const r = await loadRequestRef(user, requestId);
  if (!r) throw new NotFoundError();
  if (!canEditContent(r, user.actor)) throw new ServiceError("Attachments can only be changed while the request is a draft or returned.", 403);

  const [{ n }] = await db
    .select({ n: count() })
    .from(attachments)
    .where(and(eq(attachments.requestId, requestId), eq(attachments.kind, "SUPPORTING")));
  const originalName = sanitizeFilename(file.name);
  const problem = validateUpload({ name: originalName, size: file.bytes.byteLength }, n, kind);
  if (problem) throw new ServiceError(problem, 422);
  const ext = extensionOf(originalName);
  if (!sniffOk(ext, file.bytes)) throw new ServiceError("File content does not match its extension.", 422);

  const storedName = `${randomUUID()}.${ext}`;
  await mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true });
  await writeFile(storagePath(storedName), file.bytes, { mode: 0o640 });

  // A request has at most one name list: a new upload replaces the previous one.
  const previous =
    kind === "NAME_LIST"
      ? await db.select().from(attachments).where(and(eq(attachments.requestId, requestId), eq(attachments.kind, "NAME_LIST")))
      : [];
  const [row] = await db.transaction(async (tx) => {
    for (const p of previous) await tx.delete(attachments).where(eq(attachments.id, p.id));
    return tx
      .insert(attachments)
      .values({ requestId, kind, originalName, storedName, mimeType: mimeTypeFor(ext, kind), sizeBytes: file.bytes.byteLength, uploadedById: user.id })
      .returning();
  });
  for (const p of previous) await unlink(storagePath(p.storedName)).catch(() => {});
  return row;
}

async function loadAuthorised(user: CurrentUser, attachmentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) return null;
  const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!att) return null;
  const r = await loadRequestRef(user, att.requestId);
  if (!r) return null;
  return { att, r };
}

export async function readAttachment(user: CurrentUser, attachmentId: string) {
  const found = await loadAuthorised(user, attachmentId);
  if (!found) return null;
  const data = await readFile(storagePath(found.att.storedName));
  return { meta: found.att, data };
}

export async function deleteAttachment(user: CurrentUser, attachmentId: string) {
  const found = await loadAuthorised(user, attachmentId);
  if (!found) throw new NotFoundError();
  if (!canEditContent(found.r, user.actor)) throw new ServiceError("Attachments can only be changed while the request is a draft or returned.", 403);
  await db.transaction(async (tx) => {
    await tx.delete(attachments).where(eq(attachments.id, attachmentId));
    // Without its name list the request has no entered participant count any more.
    if (found.att.kind === "NAME_LIST") await tx.update(trainingRequests).set({ participantCount: null }).where(eq(trainingRequests.id, found.att.requestId));
  });
  await unlink(storagePath(found.att.storedName)).catch(() => {});
}
