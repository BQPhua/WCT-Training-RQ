import "server-only";
import { and, asc, count, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { businessUnits, departments, trainingRequests as tr } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { STATUSES, type Status } from "@/lib/workflow";
import { startOfYearMY } from "@/lib/format";
import { candidateCountSql } from "./dashboard";
import { ServiceError } from "./errors";
import { demoScopeWhere } from "./queries";

export class ReportsForbiddenError extends ServiceError {
  constructor() {
    super("Reports are available to L&D, HR and Business Unit Admins.", 403);
  }
}

export function canSeeReports(user: CurrentUser): boolean {
  return user.actor.roles.length > 0 || user.actor.buAdminBusinessUnitIds.length > 0;
}

const feesSql = sql<string>`coalesce(sum(${tr.feePerPax} * ${candidateCountSql}), 0)::numeric(14,2)::text`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getReports(user: CurrentUser, { year }: { year: number }) {
  if (!canSeeReports(user)) throw new ReportsForbiddenError();
  const fullScope = user.actor.roles.length > 0;
  const scope: SQL = and(demoScopeWhere(user), fullScope ? sql`true` : inArray(tr.businessUnitId, user.actor.buAdminBusinessUnitIds))!;
  const start = startOfYearMY(year);
  const end = startOfYearMY(year + 1);
  const submittedInYear = and(scope, gte(tr.submittedAt, start), lt(tr.submittedAt, end))!;
  const approvedInYear = and(scope, eq(tr.status, "APPROVED"), gte(tr.finalisedAt, start), lt(tr.finalisedAt, end))!;
  const monthOf = (col: typeof tr.submittedAt | typeof tr.finalisedAt) => sql<number>`extract(month from ${col} at time zone 'Asia/Kuala_Lumpur')::int`;

  const [submittedByMonth, approvedByMonth, bus, buSubmitted, buApproved, deptRows, typeRows, statusRows, turnaroundRows] = await Promise.all([
    db.select({ m: monthOf(tr.submittedAt), n: count() }).from(tr).where(submittedInYear).groupBy(sql`1`),
    db.select({ m: monthOf(tr.finalisedAt), n: count(), fees: feesSql }).from(tr).where(approvedInYear).groupBy(sql`1`),
    db
      .select({ id: businessUnits.id, code: businessUnits.code, name: businessUnits.name })
      .from(businessUnits)
      .where(fullScope ? sql`true` : inArray(businessUnits.id, user.actor.buAdminBusinessUnitIds))
      .orderBy(asc(businessUnits.name)),
    db.select({ buId: tr.businessUnitId, n: count() }).from(tr).where(submittedInYear).groupBy(tr.businessUnitId),
    db.select({ buId: tr.businessUnitId, n: count(), fees: feesSql }).from(tr).where(approvedInYear).groupBy(tr.businessUnitId),
    db
      .select({
        id: departments.id,
        name: departments.name,
        bu: businessUnits.name,
        n: count(),
        approved: sql<number>`count(*) filter (where ${tr.status} = 'APPROVED')`.mapWith(Number),
        fees: sql<string>`coalesce(sum(${tr.feePerPax} * ${candidateCountSql}) filter (where ${tr.status} = 'APPROVED'), 0)::numeric(14,2)::text`,
      })
      .from(tr)
      .innerJoin(departments, eq(tr.departmentId, departments.id))
      .innerJoin(businessUnits, eq(departments.businessUnitId, businessUnits.id))
      .where(submittedInYear)
      .groupBy(departments.id, departments.name, businessUnits.name)
      .orderBy(sql`count(*) desc`)
      .limit(15),
    db.select({ t: tr.trainingType, n: count() }).from(tr).where(submittedInYear).groupBy(tr.trainingType),
    db.select({ s: tr.status, n: count() }).from(tr).where(submittedInYear).groupBy(tr.status),
    // Hours spent at each approval stage: time from the previous action to the decision taken at that stage.
    db.execute<{ stage: string; avg_hours: string | null; n: string }>(sql`
      with a as (
        select ra.from_status, ra.action,
               extract(epoch from ra.created_at - lag(ra.created_at) over (partition by ra.request_id order by ra.created_at)) / 3600 as hours
        from request_actions ra join training_requests on training_requests.id = ra.request_id
        where ${submittedInYear}
      )
      select from_status as stage, round(avg(hours)::numeric, 1)::text as avg_hours, count(*)::text as n
      from a where action in ('APPROVE','REJECT') and from_status in ('PENDING_HOD','PENDING_BU','PENDING_LND','PENDING_HR')
      group by from_status
    `),
  ]);

  const byMonth = MONTHS.map((label, i) => {
    const s = submittedByMonth.find((r) => r.m === i + 1);
    const a = approvedByMonth.find((r) => r.m === i + 1);
    return { month: label, submitted: s?.n ?? 0, approved: a?.n ?? 0, fees: a?.fees ?? "0.00" };
  });

  const byBU = bus.map((b) => ({
    code: b.code,
    name: b.name,
    count: buSubmitted.find((r) => r.buId === b.id)?.n ?? 0,
    approved: buApproved.find((r) => r.buId === b.id)?.n ?? 0,
    fees: buApproved.find((r) => r.buId === b.id)?.fees ?? "0.00",
  }));

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, statusRows.find((r) => r.s === s)?.n ?? 0])) as Record<Status, number>;
  const stageRow = (s: string) => turnaroundRows.rows.find((r) => r.stage === s);
  const turnaround = (["HOD", "BU", "LND", "HR"] as const).map((stage) => {
    const row = stageRow(`PENDING_${stage}`);
    return { stage, avgHours: row?.avg_hours ? Number(row.avg_hours) : null, decisions: Number(row?.n ?? 0) };
  });

  const approvedFees = byBU.reduce((sum, b) => sum + Math.round(Number(b.fees) * 100), 0);
  return {
    year,
    scopeLabel: fullScope ? "All business units" : byBU.map((b) => b.name).join(", "),
    totals: {
      submitted: byMonth.reduce((n, m) => n + m.submitted, 0),
      approved: byMonth.reduce((n, m) => n + m.approved, 0),
      approvedFees: (approvedFees / 100).toFixed(2),
    },
    byMonth,
    byBU,
    byDepartment: deptRows,
    byType: {
      PLANNED: typeRows.find((r) => r.t === "PLANNED")?.n ?? 0,
      ADHOC: typeRows.find((r) => r.t === "ADHOC")?.n ?? 0,
    },
    statusCounts,
    turnaround,
  };
}
export type Reports = Awaited<ReturnType<typeof getReports>>;
