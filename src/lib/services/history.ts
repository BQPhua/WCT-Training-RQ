import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { businessUnits, candidates, departments, trainingRequests as tr, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { formatDateMY, formatDateTimeMY } from "@/lib/format";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/workflow";
import { candidateCountSql } from "./dashboard";
import { approvalsWhere, visibleRequestsWhere } from "./queries";

const SORTS = ["updatedAt", "submittedAt", "startDate", "refNo", "title"] as const;
type Sort = (typeof SORTS)[number];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface HistoryFilters {
  q?: string;
  status?: Status | "OPEN";
  buId?: string;
  departmentId?: string;
  type?: "PLANNED" | "ADHOC";
  from?: string;
  to?: string;
  hrdc?: "yes" | "no";
  scope: "all" | "mine" | "approvals";
  page: number;
  pageSize: number;
  sort: Sort;
  dir: "asc" | "desc";
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Parse untrusted query-string values into safe, typed filters (unknown values are dropped). */
export function parseHistoryFilters(raw: Raw, scope: HistoryFilters["scope"] = "all"): HistoryFilters {
  const status = one(raw.status);
  const sort = one(raw.sort);
  const page = Number.parseInt(one(raw.page) ?? "1", 10);
  const pageSize = Number.parseInt(one(raw.pageSize) ?? "20", 10);
  const from = one(raw.from);
  const to = one(raw.to);
  const buId = one(raw.buId);
  const departmentId = one(raw.departmentId);
  const type = one(raw.type);
  const hrdc = one(raw.hrdc);
  return {
    q: one(raw.q)?.slice(0, 100),
    status: status === "OPEN" || (STATUSES as readonly string[]).includes(status ?? "") ? (status as Status | "OPEN") : undefined,
    buId: buId && UUID.test(buId) ? buId : undefined,
    departmentId: departmentId && UUID.test(departmentId) ? departmentId : undefined,
    type: type === "PLANNED" || type === "ADHOC" ? type : undefined,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    hrdc: hrdc === "yes" || hrdc === "no" ? hrdc : undefined,
    scope,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 20,
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "updatedAt",
    dir: one(raw.dir) === "asc" ? "asc" : "desc",
  };
}

async function whereFor(user: CurrentUser, f: HistoryFilters): Promise<SQL> {
  const parts: SQL[] = [visibleRequestsWhere(user)];
  if (f.scope === "mine") parts.push(eq(tr.requesterId, user.id));
  if (f.scope === "approvals") parts.push(await approvalsWhere(user));
  if (f.status === "OPEN") parts.push(inArray(tr.status, ["PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR", "RETURNED"]));
  else if (f.status) parts.push(eq(tr.status, f.status));
  if (f.buId) parts.push(eq(tr.businessUnitId, f.buId));
  if (f.departmentId) parts.push(eq(tr.departmentId, f.departmentId));
  if (f.type) parts.push(eq(tr.trainingType, f.type));
  if (f.from) parts.push(gte(tr.startDate, f.from));
  if (f.to) parts.push(lte(tr.startDate, f.to));
  if (f.hrdc) parts.push(eq(tr.hrdcClaimable, f.hrdc === "yes"));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    parts.push(
      or(
        ilike(tr.refNo, like),
        ilike(tr.title, like),
        ilike(tr.conductedBy, like),
        ilike(users.name, like),
        sql`exists (select 1 from ${candidates} c where c.request_id = ${tr.id} and c.name ilike ${like})`,
      )!,
    );
  }
  return and(...parts)!;
}

const SORT_COL = { updatedAt: tr.updatedAt, submittedAt: tr.submittedAt, startDate: tr.startDate, refNo: tr.refNo, title: tr.title };

function baseSelect() {
  return db
    .select({
      id: tr.id,
      refNo: tr.refNo,
      title: tr.title,
      status: tr.status,
      trainingType: tr.trainingType,
      startDate: tr.startDate,
      endDate: tr.endDate,
      feePerPax: tr.feePerPax,
      hrdcClaimable: tr.hrdcClaimable,
      submittedAt: tr.submittedAt,
      finalisedAt: tr.finalisedAt,
      updatedAt: tr.updatedAt,
      requesterName: users.name,
      departmentName: departments.name,
      buName: businessUnits.name,
      candidateCount: candidateCountSql.mapWith(Number),
      totalFees: sql<string>`coalesce(${tr.feePerPax} * ${candidateCountSql}, 0)::numeric(14,2)::text`,
    })
    .from(tr)
    .innerJoin(users, eq(tr.requesterId, users.id))
    .leftJoin(departments, eq(tr.departmentId, departments.id))
    .leftJoin(businessUnits, eq(tr.businessUnitId, businessUnits.id));
}

export type HistoryRow = Awaited<ReturnType<typeof searchHistory>>["rows"][number];

export async function searchHistory(user: CurrentUser, f: HistoryFilters) {
  const where = await whereFor(user, f);
  const order = f.dir === "asc" ? asc(SORT_COL[f.sort]) : desc(SORT_COL[f.sort]);
  const [rows, [{ total }]] = await Promise.all([
    baseSelect().where(where).orderBy(sql`${order} nulls last`, desc(tr.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(tr)
      .innerJoin(users, eq(tr.requesterId, users.id))
      .where(where),
  ]);
  return { rows, total };
}

export async function exportHistoryXlsx(user: CurrentUser, f: HistoryFilters): Promise<Buffer> {
  const where = await whereFor(user, f);
  const rows = await baseSelect().where(where).orderBy(desc(tr.updatedAt)).limit(5000);
  const cands = rows.length
    ? await db
        .select({ requestId: candidates.requestId, sortOrder: candidates.sortOrder, name: candidates.name, email: candidates.email, department: candidates.department })
        .from(candidates)
        .where(inArray(candidates.requestId, rows.map((r) => r.id)))
        .orderBy(asc(candidates.requestId), asc(candidates.sortOrder))
    : [];
  const refById = new Map(rows.map((r) => [r.id, r]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "WCT Training RQ";
  wb.created = new Date();
  const ws = wb.addWorksheet("Training Requests", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Ref No", key: "ref", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Requester", key: "requester", width: 24 },
    { header: "Department", key: "dept", width: 28 },
    { header: "Business Unit", key: "bu", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Title", key: "title", width: 44 },
    { header: "Training Start", key: "start", width: 14 },
    { header: "Training End", key: "end", width: 14 },
    { header: "Fee/Pax", key: "fee", width: 12, style: { numFmt: "#,##0.00" } },
    { header: "Participants", key: "cands", width: 12 },
    { header: "Total Fees", key: "total", width: 14, style: { numFmt: "#,##0.00" } },
    { header: "HRD Corp", key: "hrdc", width: 10 },
    { header: "Submitted", key: "submitted", width: 20 },
    { header: "Finalised", key: "finalised", width: 20 },
  ];
  for (const r of rows) {
    ws.addRow({
      ref: r.refNo ?? "Draft",
      status: STATUS_LABEL[r.status],
      requester: r.requesterName,
      dept: r.departmentName ?? "",
      bu: r.buName ?? "",
      type: r.trainingType === "PLANNED" ? "Planned" : r.trainingType === "ADHOC" ? "Ad hoc" : "",
      title: r.title,
      start: formatDateMY(r.startDate),
      end: formatDateMY(r.endDate),
      fee: r.feePerPax ? Number(r.feePerPax) : null,
      cands: r.candidateCount,
      total: Number(r.totalFees),
      hrdc: r.hrdcClaimable === null ? "" : r.hrdcClaimable ? "Yes" : "No",
      submitted: r.submittedAt ? formatDateTimeMY(r.submittedAt) : "",
      finalised: r.finalisedAt ? formatDateTimeMY(r.finalisedAt) : "",
    });
  }
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.autoFilter = { from: "A1", to: "O1" };

  const cs = wb.addWorksheet("Candidates", { views: [{ state: "frozen", ySplit: 1 }] });
  cs.columns = [
    { header: "Ref No", key: "ref", width: 16 },
    { header: "#", key: "n", width: 5 },
    { header: "Candidate", key: "name", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Department", key: "dept", width: 26 },
    { header: "Training", key: "title", width: 44 },
    { header: "Status", key: "status", width: 16 },
  ];
  for (const c of cands) {
    const r = refById.get(c.requestId)!;
    cs.addRow({ ref: r.refNo ?? "Draft", n: c.sortOrder, name: c.name, email: c.email ?? "", dept: c.department ?? "", title: r.title, status: STATUS_LABEL[r.status] });
  }
  cs.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  cs.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
