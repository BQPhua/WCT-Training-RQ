import { describe, expect, it } from "vitest";
import { pdfDataFromDetail } from "@/lib/pdf/from-detail";
import type { RequestDetail } from "@/lib/services/requests";

function detail(bu: { name: string; requiresHrApproval: boolean } | null, hrApproved: boolean, status = "APPROVED"): RequestDetail {
  const act = (fromStatus: string) => ({ action: "APPROVE", fromStatus, selfApproved: false, remark: null, createdAt: new Date(), actor: { name: "X" } });
  return {
    request: { status },
    requester: { name: "R" },
    department: null,
    businessUnit: bu,
    attachments: [],
    candidates: [],
    actions: [act("PENDING_HOD"), act("PENDING_BU"), act("PENDING_LND"), ...(hrApproved ? [act("PENDING_HR")] : [])],
  } as unknown as RequestDetail;
}

describe("pdfDataFromDetail.hrNotRequiredFor", () => {
  it("names the unit when it skips HR and no HR approval exists", () => {
    expect(pdfDataFromDetail(detail({ name: "Malls", requiresHrApproval: false }, false)).hrNotRequiredFor).toBe("Malls");
  });
  it("is null when HR Head actually approved (in-flight under the old route)", () => {
    expect(pdfDataFromDetail(detail({ name: "Malls", requiresHrApproval: false }, true)).hrNotRequiredFor).toBeNull();
  });
  it("is null for E&C and for a request with no unit", () => {
    expect(pdfDataFromDetail(detail({ name: "E&C", requiresHrApproval: true }, false, "PENDING_LND")).hrNotRequiredFor).toBeNull();
    expect(pdfDataFromDetail(detail({ name: "E&C", requiresHrApproval: true }, true)).hrNotRequiredFor).toBeNull();
    expect(pdfDataFromDetail(detail(null, false)).hrNotRequiredFor).toBeNull();
  });

  it("is null while the request is with HR Head (in flight under the old route)", () => {
    const d = detail({ name: "Malls", requiresHrApproval: false }, false, "PENDING_HR");
    (d.actions as unknown[]).splice(3); // HOD, BU, L&D approved; now PENDING_HR
    expect(pdfDataFromDetail(d).hrNotRequiredFor).toBeNull();
  });
  it("names the unit for a request L&D finalised, even after the unit is switched back to HR Head", () => {
    expect(pdfDataFromDetail(detail({ name: "Malls", requiresHrApproval: true }, false)).hrNotRequiredFor).toBe("Malls");
  });
});

