import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { seed } from "@/db/seed";
import { createDraft, setNotifier } from "@/lib/services/requests";
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
