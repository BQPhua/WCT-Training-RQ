import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessUnits, notificationLogs, trainingRequests, users } from "@/db/schema";
import { env } from "@/lib/env";
import type { NotifyArgs } from "@/lib/services/requests";
import { buildPayload } from "./payload";

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 5 * 60_000;

/** Build, log and deliver a notification. Never throws. */
export async function notifyEvent(args: NotifyArgs): Promise<void> {
  try {
    if (args.recipients.to.length === 0 && args.recipients.cc.length === 0) return;
    const [r] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, args.requestId));
    if (!r) return;
    const [requester] = await db.select().from(users).where(eq(users.id, r.requesterId));
    const [actor] = await db.select().from(users).where(eq(users.id, args.event.actorId));
    const [bu] = r.businessUnitId
      ? await db.select({ name: businessUnits.name }).from(businessUnits).where(eq(businessUnits.id, r.businessUnitId))
      : [];
    const payload = buildPayload({
      event: args.event,
      request: r,
      requester,
      actor: actor ?? requester,
      recipients: args.recipients,
      remark: args.remark,
      businessUnit: bu?.name ?? null,
    });
    const [log] = await db
      .insert(notificationLogs)
      .values({ requestId: r.id, event: args.event.kind, payload: payload as unknown as Record<string, unknown> })
      .returning({ id: notificationLogs.id });
    await deliver(log.id);
  } catch (e) {
    console.error("[notify] notifyEvent error", e instanceof Error ? e.message : e);
  }
}

/** POST one logged notification to the Power Automate flow. */
export async function deliver(logId: string): Promise<boolean> {
  const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.id, logId));
  if (!log) return false;
  const url = env.POWER_AUTOMATE_FLOW_URL;
  let error: string | null = null;

  if (!url) {
    error = "Power Automate flow URL not configured";
  } else {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log.payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) error = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db
    .update(notificationLogs)
    .set({
      status: error ? "FAILED" : "SENT",
      attempts: sql`${notificationLogs.attempts} + 1`,
      lastError: error,
      sentAt: error ? null : new Date(),
    })
    .where(eq(notificationLogs.id, logId));
  return !error;
}

/** Retry FAILED notifications (attempts < 3, last tried > 5 min ago). Returns how many were retried. */
export async function retryFailed(): Promise<number> {
  const due = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.status, "FAILED"),
        lt(notificationLogs.attempts, MAX_ATTEMPTS),
        lt(notificationLogs.updatedAt, new Date(Date.now() - RETRY_AFTER_MS)),
      ),
    )
    .limit(50);
  for (const d of due) await deliver(d.id);
  return due.length;
}
