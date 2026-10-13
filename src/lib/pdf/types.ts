import type { Status } from "@/lib/workflow";

export interface PdfData {
  refNo: string | null;
  status: Status;
  trainingType: "PLANNED" | "ADHOC" | null;
  title: string;
  objective: string | null;
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
  submittedAt: Date | null;
  candidates: { name: string; staffNo?: string | null }[];
  approvals: { stage: string; name: string; decision: string; at: Date; remark: string | null }[];
  hrdcClaimable: boolean | null;
  hrdcGrantNo: string | null;
  lndRemarks: string | null;
}
