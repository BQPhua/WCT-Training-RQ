import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { seed } from "@/db/seed";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, trainingRequests } from "@/db/schema";
import { createDraft, performAction, setNotifier, updateContent, ValidationFailedError } from "@/lib/services/requests";
import { deleteAttachment, readAttachment, saveAttachment } from "@/lib/services/attachments";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

const pdf = new TextEncoder().encode("%PDF-1.4 test file");

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});
afterAll(async () => {
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});

describe("attachments", () => {
  it("stores under a UUID name and reads back for an authorised viewer", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    const att = await saveAttachment(req, id, { name: "../../etc/quote.pdf", type: "application/pdf", bytes: pdf });
    expect(att.originalName).toBe("quote.pdf");
    expect(att.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    const read = await readAttachment(req, att.id);
    expect(Buffer.from(read!.data).toString()).toContain("%PDF");
  });

  it("returns null for a user who cannot view the request", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    const att = await saveAttachment(req, id, { name: "q.pdf", type: "application/pdf", bytes: pdf });
    expect(await readAttachment(await asUser("requester.malls@demo.wct.my"), att.id)).toBeNull();
  });

  it("rejects a file whose content does not match its extension", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(
      saveAttachment(req, id, { name: "fake.pdf", type: "application/pdf", bytes: new TextEncoder().encode("MZ binary") }),
    ).rejects.toThrow(/does not match/);
  });

  it("only the requester can add attachments to their request", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(saveAttachment(await asUser("lnd1@demo.wct.my"), id, { name: "q.pdf", type: "application/pdf", bytes: pdf })).rejects.toThrow();
  });

  it("requester can delete while editable", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    const att = await saveAttachment(req, id, { name: "q.pdf", type: "application/pdf", bytes: pdf });
    await deleteAttachment(req, att.id);
    expect(await readAttachment(req, att.id)).toBeNull();
  });
});

describe("participant name list", () => {
  const csv = new TextEncoder().encode("Name,Department\nAli,QS\nSiti,Site\n");
  const versionOf = async (id: string) => (await db.select({ v: trainingRequests.version }).from(trainingRequests).where(eq(trainingRequests.id, id)))[0].v;

  it("a second name list replaces the first; supporting files are unaffected", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await saveAttachment(req, id, { name: "quote.pdf", type: "application/pdf", bytes: pdf });
    await saveAttachment(req, id, { name: "names-v1.csv", type: "text/csv", bytes: csv }, "NAME_LIST");
    await saveAttachment(req, id, { name: "names-v2.csv", type: "text/csv", bytes: csv }, "NAME_LIST");
    const rows = await db.select().from(attachments).where(eq(attachments.requestId, id));
    expect(rows.map((r) => `${r.kind}:${r.originalName}`).sort()).toEqual(["NAME_LIST:names-v2.csv", "SUPPORTING:quote.pdf"]);
  });

  it("stores the entered participant count with a name list, else the typed-name count", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    const count = async () => (await db.select({ n: trainingRequests.participantCount }).from(trainingRequests).where(eq(trainingRequests.id, id)))[0].n;
    expect(await count()).toBe(2);
    await saveAttachment(req, id, { name: "names.csv", type: "text/csv", bytes: csv }, "NAME_LIST");
    await updateContent(req, id, await versionOf(id), { ...validDraft, candidates: [], participantCount: 30 });
    expect(await count()).toBe(30);
  });

  it("submitting with both a name list and typed names fails validation; list alone submits", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, { ...validDraft, participantCount: 30 });
    await saveAttachment(req, id, { name: "names.csv", type: "text/csv", bytes: csv }, "NAME_LIST");
    await expect(performAction(req, { requestId: id, version: await versionOf(id), type: "SUBMIT" })).rejects.toBeInstanceOf(ValidationFailedError);
    await updateContent(req, id, await versionOf(id), { ...validDraft, candidates: [], participantCount: 30 });
    const r = await performAction(req, { requestId: id, version: await versionOf(id), type: "SUBMIT" });
    expect(r.status).toBe("PENDING_HOD");
  });

  it("rejects a PDF uploaded as a name list", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(saveAttachment(req, id, { name: "names.pdf", type: "application/pdf", bytes: pdf }, "NAME_LIST")).rejects.toThrow(
      "Name list must be an Excel or CSV file",
    );
  });

  it("removing the name list clears the participant count", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    const att = await saveAttachment(req, id, { name: "names.csv", type: "text/csv", bytes: csv }, "NAME_LIST");
    await updateContent(req, id, await versionOf(id), { ...validDraft, candidates: [], participantCount: 40 });
    await deleteAttachment(req, att.id);
    const [r] = await db.select({ n: trainingRequests.participantCount }).from(trainingRequests).where(eq(trainingRequests.id, id));
    expect(r.n).toBeNull();
  });
});
