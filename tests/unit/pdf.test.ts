import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderRequestPdf, type PdfData } from "@/lib/pdf/render";

const base: PdfData = {
  refNo: "TRQ-2026-0007",
  status: "APPROVED",
  trainingType: "PLANNED",
  title: "Advanced Contract Administration",
  objective: "Improve contract compliance on site.",
  relevancy: "Site engineers administer PAM 2018 contracts daily.",
  participantCount: 2,
  nameList: null,
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  startTime: "09:00",
  endTime: "17:00",
  feePerPax: "1450.00",
  venue: "WCT Tower, Level 12",
  conductedBy: "CIDB Academy",
  requesterName: "Aisyah Rahman",
  departmentName: "Land – Project Management",
  businessUnitName: "Land",
  submittedAt: new Date("2026-10-01T02:00:00Z"),
  candidates: [{ name: "Aisyah Rahman" }, { name: "Ahmad Faiz" }],
  approvals: [
    { stage: "Department HOD", name: "Tan Wei Ming", decision: "Approved", at: new Date("2026-10-02T02:00:00Z"), remark: null },
    { stage: "BU Admin", name: "Lee Mei Ling", decision: "Approved", at: new Date("2026-10-02T06:00:00Z"), remark: null },
    { stage: "L&D Team", name: "Nurul Izzah", decision: "Approved", at: new Date("2026-10-03T02:00:00Z"), remark: "HRD Corp claimable" },
    { stage: "HR Head", name: "Farah Hanim", decision: "Approved", at: new Date("2026-10-04T02:00:00Z"), remark: null },
  ],
  hrdcClaimable: true,
  hrdcGrantNo: "HRDC-55",
  lndRemarks: null,
  hrNotRequiredFor: null,
};

async function text(buf: Buffer) {
  const p = new PDFParse({ data: new Uint8Array(buf) });
  const r = await p.getText();
  await p.destroy();
  return r.text;
}

describe("renderRequestPdf", () => {
  it("renders a PDF reproducing the WCT-F-4.18-2 form", async () => {
    const buf = await renderRequestPdf(base);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const t = await text(buf);
    for (const s of ["WCT BERHAD", "TRAINING REQUISITION FORM", "Ref No: WCT-F-4.18-2", "Revision: REV2", "Date: 20/03/2024", "SECTION 3: PROPOSED CANDIDATES", "Ahmad Faiz", "TRQ-2026-0007", "Tan Wei Ming", "Quality Management System"]) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain("NOT FINAL");
  }, 30000);

  it("watermarks requests that are not yet approved", async () => {
    const t = await text(await renderRequestPdf({ ...base, status: "PENDING_LND", approvals: base.approvals.slice(0, 1) }));
    expect(t).toContain("NOT FINAL");
  }, 30000);

  it("uses the new wording and shows relevancy and the BU Admin approval", async () => {
    const t = await text(await renderRequestPdf(base));
    for (const s of ["FROM (REQUESTER):", "TRAINING DATES:", "RELEVANCY:", "Site engineers administer PAM 2018 contracts daily.", "BU Admin", "Lee Mei Ling"]) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain("REQUISITIONER");
    expect(t).not.toContain("DATE(S):");
  }, 30000);

  it("refers to the attached name list instead of listing candidates", async () => {
    const t = await text(await renderRequestPdf({ ...base, candidates: [], participantCount: 25, nameList: { fileName: "names.xlsx" } }));
    expect(t).toContain("Refer to attached name list: names.xlsx (25 participants)");
    expect(t).toContain("36,250.00"); // 25 × RM 1,450.00
  }, 30000);

  it("renders older requests without relevancy or participant count", async () => {
    const t = await text(await renderRequestPdf({ ...base, relevancy: null, participantCount: null }));
    expect(t).toContain("2,900.00"); // falls back to 2 typed names
  }, 30000);

  it('HR block reads "Not required for Malls" when no HR approval and the unit skips HR', async () => {
    const t = await text(
      await renderRequestPdf({ ...base, businessUnitName: "Malls", hrNotRequiredFor: "Malls", approvals: base.approvals.slice(0, 3) }),
    );
    expect(t).toContain("Not required for Malls");
    expect(t).not.toContain("Farah Hanim");
  }, 30000);

  it("an HR-approved request shows the HR Head, not the skip note", async () => {
    const t = await text(await renderRequestPdf(base));
    expect(t).toContain("Farah Hanim (digitally approved)");
    expect(t).not.toContain("Not required for");
  }, 30000);
});
