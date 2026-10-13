import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireApiUser } from "@/lib/auth/current-user";
import { apiError } from "@/lib/api";
import { getReports } from "@/lib/services/reports";
import { STAGE_LABEL, STATUS_LABEL, STATUSES } from "@/lib/workflow";

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const y = Number(req.nextUrl.searchParams.get("year"));
    const year = Number.isInteger(y) && y > 2000 ? y : new Date().getFullYear();
    const r = await getReports(user, { year });
    const wb = new ExcelJS.Workbook();
    const sheet = (name: string, cols: [string, number][], rows: (string | number)[][]) => {
      const ws = wb.addWorksheet(name);
      ws.columns = cols.map(([header, width]) => ({ header, width }));
      rows.forEach((row) => ws.addRow(row));
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    };
    sheet("By month", [["Month", 10], ["Submitted", 12], ["Approved", 12], ["Approved spend (MYR)", 22]], r.byMonth.map((m) => [m.month, m.submitted, m.approved, Number(m.fees)]));
    sheet("By business unit", [["Business unit", 18], ["Submitted", 12], ["Approved", 12], ["Approved spend (MYR)", 22]], r.byBU.map((b) => [b.name, b.count, b.approved, Number(b.fees)]));
    sheet("By department", [["Department", 32], ["Business unit", 16], ["Submitted", 12], ["Approved", 12], ["Approved spend (MYR)", 22]], r.byDepartment.map((d) => [d.name, d.bu, d.n, d.approved, Number(d.fees)]));
    sheet("Stage turnaround", [["Stage", 18], ["Average hours", 16], ["Decisions", 12]], r.turnaround.map((t) => [STAGE_LABEL[t.stage], t.avgHours ?? "", t.decisions]));
    sheet("Status", [["Status", 18], ["Requests", 12]], STATUSES.map((s) => [STATUS_LABEL[s], r.statusCounts[s]]));
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="training-rq-report-${year}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
