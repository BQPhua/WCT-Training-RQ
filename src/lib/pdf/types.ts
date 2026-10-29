import type { Status } from "@/lib/workflow";

export interface PdfData {
  refNo: string | null;
  status: Status;
  trainingType: "PLANNED" | "ADHOC" | null;
  title: string;
  objective: string | null;
  relevancy: string | null;
  /** Stored participant count; null on older requests (fall back to the typed names). */
  participantCount: number | null;
  /** Attached participant name list, used instead of typed names for more than 8 people. */
  nameList: { fileName: string } | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  feePerPax: string | null;
  venue: string | null;
  conductedBy: string | null;
  requesterName: string;
  departmentName: string | null;
  businessUnitName: string | null;
  /** Unit name when its requests are finalised by L&D and HR Head never approved this one; else null. */
  hrNotRequiredFor: string | null;
  submittedAt: Date | null;
  candidates: { name: string }[];
  approvals: { stage: string; name: string; decision: string; at: Date; remark: string | null }[];
  hrdcClaimable: boolean | null;
  hrdcGrantNo: string | null;
  lndRemarks: string | null;
}
