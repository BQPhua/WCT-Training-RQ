import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainingRequests } from "@/db/schema";
import { seed } from "@/db/seed";
import { pdfDataFromDetail } from "@/lib/pdf/from-detail";
import { saveAttachment } from "@/lib/services/attachments";
import { buildRequestXlsx } from "@/lib/services/request-xlsx";
import { createDraft, getRequestForUser, performAction, setNotifier, updateContent } from "@/lib/services/requests";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

const versionOf = async (id: string) => (await db.select({ v: trainingRequests.version }).from(trainingRequests).where(eq(trainingRequests.id, id)))[0].v;

async function workbook(email: string, id: string) {
  const d = await getRequestForUser(await asUser(email), id);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await buildRequestXlsx(pdfDataFromDetail(d!))) as unknown as ArrayBuffer);
  return wb;
}

describe("per-request Excel export", () => {
  it("has Request, Candidates and Approval trail sheets after a full approval", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await performAction(req, { requestId: id, version: await versionOf(id), type: "SUBMIT" });
    for (const email of ["hod.land@demo.wct.my", "buadmin.land@demo.wct.my", "lnd1@demo.wct.my", "hrhead@demo.wct.my"]) {
      await performAction(await asUser(email), { requestId: id, version: await versionOf(id), type: "APPROVE" });
    }
    const wb = await workbook("hrhead@demo.wct.my", id);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Request", "Candidates", "Approval trail"]);
    const labels = wb.getWorksheet("Request")!.getColumn(1).values.filter(Boolean).map(String);
    for (const l of ["Relevancy", "Training Dates", "Participants", "Total fees"]) expect(labels).toContain(l);
    expect(wb.getWorksheet("Approval trail")!.actualRowCount).toBe(5); // header + 4 approvals
    expect(wb.getWorksheet("Candidates")!.getCell("B2").value).toBe("Aisyah Rahman");
  });

  it("points to the name list when one is attached", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await saveAttachment(req, id, { name: "names.xlsx", type: "", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]) }, "NAME_LIST");
    await updateContent(req, id, await versionOf(id), { ...validDraft, candidates: [], participantCount: 25 });
    const wb = await workbook("requester@demo.wct.my", id);
    expect(wb.getWorksheet("Candidates")!.getCell("A2").value).toBe("Refer to attached name list: names.xlsx (25 participants)");
  });
});
