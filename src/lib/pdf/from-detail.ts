import type { RequestDetail } from "@/lib/services/requests";
import type { PdfData } from "./types";

const STAGE: Record<string, string> = { PENDING_HOD: "Department HOD", PENDING_BU: "BU Admin", PENDING_LND: "L&D Team", PENDING_HR: "HR Head" };

/**
 * The unit name when HR Head's sign-off doesn't apply to this request, else null.
 * An approved request answers from its record (did L&D give the final approval?);
 * an open one from its unit's setting, unless it is already with HR Head.
 */
function hrNotRequiredFor(d: RequestDetail): string | null {
  const bu = d.businessUnit;
  if (!bu) return null;
  const approvals = d.actions.filter((a) => a.action === "APPROVE");
  if (approvals.some((a) => a.fromStatus === "PENDING_HR")) return null;
  if (d.request.status === "APPROVED") return approvals.at(-1)?.fromStatus === "PENDING_LND" ? bu.name : null;
  if (d.request.status === "PENDING_HR") return null;
  return bu.requiresHrApproval ? null : bu.name;
}

export function pdfDataFromDetail(d: RequestDetail): PdfData {
  const r = d.request;
  return {
    refNo: r.refNo,
    status: r.status,
    trainingType: r.trainingType,
    title: r.title,
    objective: r.objective,
    relevancy: r.relevancy,
    participantCount: r.participantCount,
    nameList: (() => {
      const a = d.attachments.find((x) => x.kind === "NAME_LIST");
      return a ? { fileName: a.originalName } : null;
    })(),
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
    candidates: d.candidates.map((c) => ({ name: c.name })),
    approvals: d.actions
      .filter((a) => (a.action === "APPROVE" || a.action === "REJECT") && a.fromStatus && STAGE[a.fromStatus])
      .map((a) => ({
        stage: STAGE[a.fromStatus!],
        name: a.actor.name,
        decision: a.action === "APPROVE" ? (a.selfApproved ? "Approved (self)" : "Approved") : "Rejected",
        at: a.createdAt,
        remark: a.remark,
      })),
    hrdcClaimable: r.hrdcClaimable,
    hrdcGrantNo: r.hrdcGrantNo,
    lndRemarks: r.lndRemarks,
    hrNotRequiredFor: hrNotRequiredFor(d),
  };
}
