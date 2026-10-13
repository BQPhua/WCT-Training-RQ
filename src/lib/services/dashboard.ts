import "server-only";
import { and, count, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, requestActions, trainingRequests as tr, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { awaitingActionWhere, visibleRequestsWhere } from "./queries";

const OPEN = ["DRAFT", "PENDING_HOD", "PENDING_LND", "PENDING_HR", "RETURNED"] as const;

export const candidateCountSql = sql<number>`(select count(*) from candidates c where c.request_id = ${tr.id})`;

export async function getDashboard(user: CurrentUser) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const visible = visibleRequestsWhere(user);
  const awaiting = await awaitingActionWhere(user);

  const [[myOpen], [awaitingMe], [approved], board, awaitingList, recentActivity, awaitingIds] = await Promise.all([
    db.select({ n: count() }).from(tr).where(and(eq(tr.requesterId, user.id), inArray(tr.status, [...OPEN]))),
    db.select({ n: count() }).from(tr).where(awaiting),
    db
      .select({
        n: count(),
        fees: sql<string>`coalesce(sum(${tr.feePerPax} * ${candidateCountSql}), 0)::numeric(14,2)::text`,
      })
      .from(tr)
      .where(and(visible, eq(tr.status, "APPROVED"), gte(tr.finalisedAt, yearStart))),
    db
      .select({
        id: tr.id,
        refNo: tr.refNo,
        title: tr.title,
        status: tr.status,
        startDate: tr.startDate,
        requesterName: users.name,
      })
      .from(tr)
      .innerJoin(users, eq(tr.requesterId, users.id))
      .where(and(visible, gte(tr.createdAt, yearStart), ne(tr.status, "DRAFT")))
      .orderBy(tr.createdAt)
      .limit(160),
    db
      .select({
        id: tr.id,
        refNo: tr.refNo,
        title: tr.title,
        status: tr.status,
        submittedAt: tr.submittedAt,
        startDate: tr.startDate,
        requesterName: users.name,
        departmentName: departments.name,
      })
      .from(tr)
      .innerJoin(users, eq(tr.requesterId, users.id))
      .leftJoin(departments, eq(tr.departmentId, departments.id))
      .where(awaiting)
      .orderBy(tr.submittedAt)
      .limit(6),
    db
      .select({
        id: requestActions.id,
        action: requestActions.action,
        toStatus: requestActions.toStatus,
        sentBackTo: requestActions.sentBackTo,
        createdAt: requestActions.createdAt,
        actorName: users.name,
        requestId: tr.id,
        refNo: tr.refNo,
        title: tr.title,
      })
      .from(requestActions)
      .innerJoin(tr, eq(requestActions.requestId, tr.id))
      .innerJoin(users, eq(requestActions.actorId, users.id))
      .where(and(visible, ne(requestActions.action, "CREATE"), ne(tr.status, "DRAFT")))
      .orderBy(desc(requestActions.createdAt))
      .limit(8),
    db.select({ id: tr.id }).from(tr).where(awaiting).limit(300),
  ]);

  return {
    myOpen: myOpen.n,
    awaitingMe: awaitingMe.n,
    approvedThisYear: approved.n,
    feesThisYear: approved.fees,
    board,
    awaitingList,
    recentActivity,
    awaitingIds: awaitingIds.map((r) => r.id),
  };
}

export async function countAwaiting(user: CurrentUser): Promise<number> {
  const [r] = await db.select({ n: count() }).from(tr).where(await awaitingActionWhere(user));
  return r.n;
}
