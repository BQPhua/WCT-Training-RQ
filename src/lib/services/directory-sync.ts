import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, not, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, directorySyncRuns, users, type DirectorySyncRun, type User } from "@/db/schema";
import { DEMO_EMAIL_DOMAIN } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { ServiceError } from "./errors";
import type { GraphConfig } from "./graph";
import { getGraphToken } from "./graph";

/** One WCT staff member as read from Microsoft 365. */
export interface DirPerson {
  oid: string;
  email: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
}

type GraphUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  accountEnabled?: boolean | null;
  userType?: string | null;
};

const MAX_PAGES = 100; // 99,900 people: far beyond WCT, but stops a runaway nextLink loop

/** Every enabled member account in the tenant (guests and disabled accounts excluded). */
export async function fetchDirectoryPeople(cfg: GraphConfig, fetchFn: typeof fetch = fetch): Promise<DirPerson[]> {
  const token = await getGraphToken(cfg, fetchFn);
  const params = new URLSearchParams({
    $select: "id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled,userType",
    $filter: "accountEnabled eq true and userType eq 'Member'",
    $count: "true",
    $top: "999",
  });
  let url: string | undefined = `https://graph.microsoft.com/v1.0/users?${params}`;
  const people: DirPerson[] = [];
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token.value}`, ConsistencyLevel: "eventual" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Microsoft Graph refused the staff list (HTTP ${res.status}). Check that User.Read.All has admin consent.`);
    const json = (await res.json()) as { value: GraphUser[]; "@odata.nextLink"?: string };
    for (const u of json.value) {
      if (u.accountEnabled === false || (u.userType && u.userType !== "Member")) continue;
      const email = (u.mail || u.userPrincipalName || "").trim().toLowerCase();
      if (!email) continue;
      people.push({ oid: u.id, email, name: u.displayName?.trim() || email, jobTitle: u.jobTitle?.trim() || null, department: u.department?.trim() || null });
    }
    url = json["@odata.nextLink"];
  }
  return people;
}

const BATCH = 500;
const ABANDONED_AFTER_MS = 15 * 60_000;
const isDemoEmail = (email: string) => email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);

/** The server's Graph settings, or null when the directory is switched off or incomplete. */
export function directoryConfigFromEnv(): GraphConfig | null {
  if (!env.DIRECTORY_SEARCH_GRAPH || !env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID || !env.ENTRA_CLIENT_SECRET) return null;
  return { tenantId: env.ENTRA_TENANT_ID, clientId: env.ENTRA_CLIENT_ID, clientSecret: env.ENTRA_CLIENT_SECRET };
}

type Counts = { added: number; updated: number; skipped: number };

/**
 * Copy Microsoft 365 staff into the users table (same matching as sign-in: Microsoft ID, then email).
 * New people are added "not signed in yet"; existing ones get their name, job title and Microsoft 365
 * department refreshed. Demo accounts and users an admin deactivated are never touched.
 */
async function upsertPeople(people: DirPerson[], seenAt: Date, counts: Counts) {
  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const deptByName = new Map(deptRows.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const unique = [...new Map(people.map((p) => [p.oid, p])).values()].filter((p, i, all) => all.findIndex((q) => q.email === p.email) === i);

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(users)
        .where(or(inArray(users.entraOid, batch.map((p) => p.oid)), inArray(users.email, batch.map((p) => p.email))));
      const byOid = new Map(existing.filter((u) => u.entraOid).map((u) => [u.entraOid!, u]));
      const byEmail = new Map(existing.map((u) => [u.email, u]));

      for (const p of batch) {
        const ex: User | undefined = byOid.get(p.oid) ?? byEmail.get(p.email);
        if (isDemoEmail(p.email) || (ex && (isDemoEmail(ex.email) || !ex.isActive))) {
          counts.skipped++;
          continue;
        }
        const departmentId = (p.department && deptByName.get(p.department.toLowerCase())) || null;
        if (!ex) {
          await tx.insert(users).values({
            entraOid: p.oid,
            email: p.email,
            name: p.name,
            jobTitle: p.jobTitle,
            entraDepartment: p.department,
            departmentId,
            directorySeenAt: seenAt,
          });
          counts.added++;
          continue;
        }
        // Never take an email address another account already uses.
        const emailTaken = p.email !== ex.email && byEmail.has(p.email) && byEmail.get(p.email)!.id !== ex.id;
        const next = {
          entraOid: p.oid,
          email: emailTaken ? ex.email : p.email,
          name: p.name,
          jobTitle: p.jobTitle ?? ex.jobTitle,
          entraDepartment: p.department,
          departmentId: departmentId ?? ex.departmentId,
        };
        const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== ex[k]);
        await tx.update(users).set({ ...next, directorySeenAt: seenAt }).where(eq(users.id, ex.id));
        if (changed) counts.updated++;
      }
    });
  }
}

/** Active, non-demo people with a Microsoft ID whom the run that started at `since` did not find. */
async function countNoLongerInDirectory(since: Date): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        isNotNull(users.entraOid),
        not(sql`lower(${users.email}) like ${"%" + DEMO_EMAIL_DOMAIN}`),
        or(isNull(users.directorySeenAt), lt(users.directorySeenAt, since)),
      ),
    );
  return n;
}

/** Run one sync. Only one runs at a time (a unique index allows a single unfinished run). */
export async function runDirectorySync(opts: {
  trigger: "cron" | "manual";
  triggeredBy?: string | null;
  config?: GraphConfig | null;
  fetchFn?: typeof fetch;
}): Promise<DirectorySyncRun> {
  const config = opts.config === undefined ? directoryConfigFromEnv() : opts.config;
  if (!config) throw new ServiceError("Microsoft 365 sync is off. Set DIRECTORY_SEARCH_GRAPH=true and the ENTRA_* settings on the server.", 409);

  // A run that never finished (server restarted mid-sync) stops blocking after 15 minutes.
  await db
    .update(directorySyncRuns)
    .set({ finishedAt: new Date(), ok: false, error: "Abandoned (no result after 15 minutes)" })
    .where(and(isNull(directorySyncRuns.finishedAt), lt(directorySyncRuns.startedAt, new Date(Date.now() - ABANDONED_AFTER_MS))));

  let run: DirectorySyncRun;
  try {
    [run] = await db.insert(directorySyncRuns).values({ trigger: opts.trigger, triggeredById: opts.triggeredBy ?? null }).returning();
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code;
    if (code === "23505") throw new ServiceError("A sync is already running. Try again in a minute.", 409);
    throw e;
  }

  const counts: Counts = { added: 0, updated: 0, skipped: 0 };
  try {
    const people = await fetchDirectoryPeople(config, opts.fetchFn);
    await upsertPeople(people, run.startedAt, counts);
    const flagged = await countNoLongerInDirectory(run.startedAt);
    [run] = await db.update(directorySyncRuns).set({ ...counts, flagged, ok: true, finishedAt: new Date() }).where(eq(directorySyncRuns.id, run.id)).returning();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    [run] = await db.update(directorySyncRuns).set({ ...counts, flagged: 0, ok: false, error, finishedAt: new Date() }).where(eq(directorySyncRuns.id, run.id)).returning();
  }
  return run;
}

/** The most recent sync run, for the Users page. */
export async function lastSyncRun(): Promise<DirectorySyncRun | null> {
  const [run] = await db.select().from(directorySyncRuns).orderBy(desc(directorySyncRuns.startedAt)).limit(1);
  return run ?? null;
}

/** When the most recent complete run started (people not seen since then are "no longer in Microsoft 365"). */
export async function lastCompleteSyncStart(): Promise<Date | null> {
  const [run] = await db
    .select({ startedAt: directorySyncRuns.startedAt })
    .from(directorySyncRuns)
    .where(eq(directorySyncRuns.ok, true))
    .orderBy(desc(directorySyncRuns.startedAt))
    .limit(1);
  return run?.startedAt ?? null;
}
