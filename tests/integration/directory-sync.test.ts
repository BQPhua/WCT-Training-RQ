import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, directorySyncRuns, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { runDirectorySync } from "@/lib/services/directory-sync";
import { resetDb } from "./setup";

const cfg = { tenantId: "t1", clientId: "c1", clientSecret: "s1" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const person = (id: string, email: string, over: Record<string, unknown> = {}) => ({
  id, displayName: `Person ${id}`, mail: email, userPrincipalName: email, jobTitle: "Engineer", department: null, accountEnabled: true, userType: "Member", ...over,
});

/** A fake Graph: `pages` of users; a page given as an Error fails with HTTP 503. */
function graph(pages: (unknown[] | Error)[]) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/oauth2/v2.0/token")) return json({ access_token: "tok", expires_in: 3600 });
    const i = u.includes("skiptoken=") ? Number(new URL(u).searchParams.get("skiptoken")) : 0;
    const page = pages[i];
    if (page instanceof Error) return json({ error: { message: page.message } }, 503);
    return json({ value: page, ...(i + 1 < pages.length ? { "@odata.nextLink": `https://graph.microsoft.com/v1.0/users?skiptoken=${i + 1}` } : {}) });
  }) as unknown as typeof fetch;
}

const sync = (pages: (unknown[] | Error)[]) => runDirectorySync({ trigger: "manual", config: cfg, fetchFn: graph(pages) });
const byEmail = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0];

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
});

describe("runDirectorySync", () => {
  it("adds new staff who have never signed in", async () => {
    const run = await sync([[person("oid-1", "Siti.Aminah@wct.my"), person("oid-2", "kumar@wct.my")]]);
    expect(run).toMatchObject({ ok: true, added: 2, updated: 0 });
    const siti = await byEmail("siti.aminah@wct.my");
    expect(siti).toMatchObject({ entraOid: "oid-1", name: "Person oid-1", lastLoginAt: null, isActive: true });
    expect(siti.directorySeenAt).not.toBeNull();
  });

  it("links an admin-added user by email and fills in their Microsoft ID", async () => {
    await db.insert(users).values({ email: "farid@wct.my", name: "Farid (added by HR)" });
    const run = await sync([[person("oid-9", "farid@wct.my", { displayName: "Farid Ismail", jobTitle: "QS" })]]);
    expect(run).toMatchObject({ added: 0, updated: 1 });
    expect(await byEmail("farid@wct.my")).toMatchObject({ entraOid: "oid-9", name: "Farid Ismail", jobTitle: "QS" });
  });

  it("matches the department by name, but an unknown department never clears one already set", async () => {
    const [eng] = await db.select().from(departments).where(eq(departments.name, "E&C – Engineering"));
    await sync([[person("oid-1", "a@wct.my", { department: "e&c – engineering" })]]);
    expect((await byEmail("a@wct.my")).departmentId).toBe(eng.id);
    await sync([[person("oid-1", "a@wct.my", { department: "Some New Dept" })]]);
    expect((await byEmail("a@wct.my")).departmentId).toBe(eng.id);
  });

  it("never touches demo accounts or users an admin deactivated", async () => {
    await db.insert(users).values({ email: "left@wct.my", name: "Left Staff", isActive: false });
    const run = await sync([[person("oid-d", "requester@demo.wct.my", { displayName: "Changed" }), person("oid-x", "left@wct.my", { displayName: "Changed" })]]);
    expect(run).toMatchObject({ added: 0, updated: 0, skipped: 2 });
    expect((await byEmail("requester@demo.wct.my")).name).toBe("Aisyah Rahman");
    expect(await byEmail("left@wct.my")).toMatchObject({ name: "Left Staff", isActive: false, entraOid: null });
  });

  it("counts people no longer in Microsoft 365 after a complete run, without deactivating them", async () => {
    await sync([[person("oid-1", "a@wct.my"), person("oid-2", "b@wct.my")]]);
    const run = await sync([[person("oid-1", "a@wct.my")]]);
    expect(run).toMatchObject({ ok: true, flagged: 1 });
    expect((await byEmail("b@wct.my")).isActive).toBe(true);
  });

  it("a run that fails midway records the error, flags nobody and frees the next run", async () => {
    await sync([[person("oid-1", "a@wct.my"), person("oid-2", "b@wct.my")]]);
    const failed = await sync([[person("oid-1", "a@wct.my")], new Error("Service unavailable")]);
    expect(failed.ok).toBe(false);
    expect(failed.error).toMatch(/HTTP 503/);
    expect(failed.flagged).toBe(0);
    expect((await sync([[person("oid-1", "a@wct.my"), person("oid-2", "b@wct.my")]])).ok).toBe(true);
  });

  it("refuses a second run while one is in progress, and recovers a run abandoned over 15 minutes ago", async () => {
    await db.insert(directorySyncRuns).values({ trigger: "cron" });
    await expect(sync([[person("oid-1", "a@wct.my")]])).rejects.toThrow("A sync is already running");
    await db.update(directorySyncRuns).set({ startedAt: new Date(Date.now() - 16 * 60_000) });
    expect((await sync([[person("oid-1", "a@wct.my")]])).ok).toBe(true);
    const [stale] = await db.select().from(directorySyncRuns).where(eq(directorySyncRuns.trigger, "cron"));
    expect(stale).toMatchObject({ ok: false, error: "Abandoned (no result after 15 minutes)" });
  });

  it("is refused when the directory isn't configured", async () => {
    await expect(runDirectorySync({ trigger: "manual", config: null })).rejects.toThrow(/DIRECTORY_SEARCH_GRAPH/);
  });
});

describe("Users page data and triggers", () => {
  it("listUsers filters by sign-in and directory status", async () => {
    const { listUsers } = await import("@/lib/services/admin");
    const { asUser } = await import("./helpers");
    await db.insert(users).values({ email: "it.admin@wct.my", name: "IT Admin", lastLoginAt: new Date() });
    const [admin] = await db.select().from(users).where(eq(users.email, "it.admin@wct.my"));
    const { roleAssignments } = await import("@/db/schema");
    await db.insert(roleAssignments).values({ userId: admin.id, role: "SYS_ADMIN" });
    await sync([[person("oid-1", "a@wct.my"), person("oid-2", "b@wct.my")]]);
    await sync([[person("oid-1", "a@wct.my")]]);
    const me = await asUser("it.admin@wct.my");

    const notSignedIn = await listUsers(me, undefined, "not-signed-in");
    expect(notSignedIn.map((u) => u.email)).toEqual(expect.arrayContaining(["a@wct.my", "b@wct.my"]));
    expect(notSignedIn.some((u) => u.email === "it.admin@wct.my")).toBe(false);

    const left = await listUsers(me, undefined, "left");
    expect(left.map((u) => u.email)).toEqual(["b@wct.my"]);
    expect(left[0].leftDirectory).toBe(true);
    expect((await listUsers(me, "a@wct", "all"))[0].leftDirectory).toBe(false);
  });

  it("Sync now refuses demo admins and explains when the sync is off", async () => {
    const { syncDirectoryNow } = await import("@/lib/services/admin");
    const { asUser } = await import("./helpers");
    await expect(syncDirectoryNow(await asUser("admin@demo.wct.my"))).rejects.toThrow("Demo accounts can look at settings but can't change them.");
    await db.insert(users).values({ email: "it.admin@wct.my", name: "IT Admin" });
    const [admin] = await db.select().from(users).where(eq(users.email, "it.admin@wct.my"));
    const { roleAssignments } = await import("@/db/schema");
    await db.insert(roleAssignments).values({ userId: admin.id, role: "SYS_ADMIN" });
    vi.stubEnv("DIRECTORY_SEARCH_GRAPH", "false");
    await expect(syncDirectoryNow(await asUser("it.admin@wct.my"))).rejects.toThrow(/sync is off/);
    vi.unstubAllEnvs();
  });

  it("the nightly endpoint needs the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const { POST } = await import("@/app/api/cron/directory-sync/route");
    const req = (auth?: string) => new Request("http://x/api/cron/directory-sync", { method: "POST", headers: auth ? { authorization: auth } : {} });
    expect((await POST(req() as never)).status).toBe(401);
    expect((await POST(req("Bearer wrong") as never)).status).toBe(401);
    vi.stubEnv("DIRECTORY_SEARCH_GRAPH", "false");
    const off = await POST(req("Bearer s3cret") as never);
    expect(off.status).toBe(409);
    vi.unstubAllEnvs();
  });
});
