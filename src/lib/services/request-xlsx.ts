import ExcelJS from "exceljs";
import { effectiveParticipants, formatDateMY, formatDateRange, formatDateTimeMY, formatMYR, formatTime12, totalFees } from "@/lib/format";
import type { PdfData } from "@/lib/pdf/types";
import { STATUS_LABEL } from "@/lib/workflow";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF13213A" } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

/** One request as a workbook: details (in PDF order), candidates, approval trail. */
export async function buildRequestXlsx(d: PdfData): Promise<Buffer> {
  const participants = effectiveParticipants(d, d.candidates.length);
  const wb = new ExcelJS.Workbook();
  wb.creator = "WCT Training RQ";
  wb.created = new Date();

  const info = wb.addWorksheet("Request");
  info.columns = [
    { header: "Field", key: "k", width: 26 },
    { header: "Value", key: "v", width: 80 },
  ];
  styleHeader(info.getRow(1));
  const rows: [string, string][] = [
    ["Reference", d.refNo ?? "Draft"],
    ["Status", STATUS_LABEL[d.status]],
    ["From (Requester)", d.requesterName],
    ["Department", [d.departmentName, d.businessUnitName && `(${d.businessUnitName})`].filter(Boolean).join(" ")],
    ["Training type", d.trainingType === "PLANNED" ? "Planned training" : d.trainingType === "ADHOC" ? "Ad hoc training" : ""],
    ["Training title / subject", d.title],
    ["Objective", d.objective ?? ""],
    ["Relevancy", d.relevancy ?? ""],
    ["Training Dates", formatDateRange(d.startDate, d.endDate)],
    ["Time", d.startTime ? `${formatTime12(d.startTime)} – ${formatTime12(d.endTime)}` : ""],
    ["Venue", d.venue ?? ""],
    ["Conducted by", d.conductedBy ?? ""],
    ["Fee per participant (MYR)", formatMYR(d.feePerPax)],
    ["Participants", String(participants)],
    ["Total fees", formatMYR(totalFees(d.feePerPax, participants))],
    ["Submitted", d.submittedAt ? formatDateMY(d.submittedAt) : ""],
    ["HRD Corp claimable", d.hrdcClaimable === null ? "" : d.hrdcClaimable ? `Yes${d.hrdcGrantNo ? ` (${d.hrdcGrantNo})` : ""}` : "No"],
    ["L&D remarks", d.lndRemarks ?? ""],
  ];
  for (const [k, v] of rows) info.addRow({ k, v });
  info.getColumn("v").alignment = { wrapText: true, vertical: "top" };
  info.getColumn("k").font = { bold: true };

  const cand = wb.addWorksheet("Candidates");
  cand.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "Candidate name", key: "name", width: 48 },
  ];
  styleHeader(cand.getRow(1));
  if (d.nameList) {
    cand.mergeCells("A2:B2");
    cand.getCell("A2").value = `Refer to attached name list: ${d.nameList.fileName} (${participants} participants)`;
  } else {
    d.candidates.forEach((c, i) => cand.addRow({ n: i + 1, name: c.name }));
  }

  const trail = wb.addWorksheet("Approval trail");
  trail.columns = [
    { header: "Stage", key: "stage", width: 18 },
    { header: "Name", key: "name", width: 28 },
    { header: "Decision", key: "decision", width: 18 },
    { header: "Date & time", key: "at", width: 22 },
    { header: "Remark", key: "remark", width: 60 },
  ];
  styleHeader(trail.getRow(1));
  for (const a of d.approvals) trail.addRow({ stage: a.stage, name: a.name, decision: a.decision, at: formatDateTimeMY(a.at), remark: a.remark ?? "" });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
