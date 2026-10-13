import type { RequestDetail } from "@/lib/services/requests";
import type { PdfData } from "./types";

const STAGE: Record<string, string> = { PENDING_HOD: "Department HOD", PENDING_LND: "L&D Team", PENDING_HR: "HR Head" };

export function pdfDataFromDetail(d: RequestDetail): PdfData {
  const r = d.request;
  return {
    refNo: r.refNo,
    status: r.status,
    trainingType: r.trainingType,
    title: r.title,
    objective: r.objective,
    startDate: r.startDate,
    endDate: r.endDate,
    startTime: r.startTime,
    endTime: r.endTime,
    feePerPax: r.feePerPax,
    venue: r.venue,
    conductedBy: r.conductedBy,
    requesterName: d.requester.name,
    departmentName: d.department?.name ?? null,
    businessUnitName: d.businessUnit?.name ?? null,
    submittedAt: r.submittedAt,
    candidates: d.candidates.map((c) => ({ name: c.name, staffNo: c.staffNo })),
    approvals: d.actions
      .filter((a) => (a.action === "APPROVE" || a.action === "REJECT") && a.fromStatus && STAGE[a.fromStatus])
      .map((a) => ({
        stage: STAGE[a.fromStatus!],
        name: a.actor.name,
        decision: a.action === "APPROVE" ? (a.selfApproved ? "Approved (self)" : "Approved") : "Sent back",
        at: a.createdAt,
        remark: a.remark,
      })),
    hrdcClaimable: r.hrdcClaimable,
    hrdcGrantNo: r.hrdcGrantNo,
    lndRemarks: r.lndRemarks,
  };
}
