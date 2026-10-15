import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, roleAssignments, trainingRequests, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { readAttachment, saveAttachment } from "@/lib/services/attachments";
import { getDashboard } from "@/lib/services/dashboard";
import { parseHistoryFilters, searchHistory } from "@/lib/services/history";
import { getReports } from "@/lib/services/reports";
import { createDraft, getRequestForUser, performAction, setNotifier } from "@/lib/services/requests";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

/** A real staff request (in a demo department, so demo approvers would normally see it) plus one demo request. */
async function setup() {
  const [dept] = await db.select().from(departments).where(eq(departments.name, "Land – Project Management"));
  await db.insert(users).values({ email: "real.staff@wct.my", name: "Real Staff", departmentId: dept.id });
  const [admin] = await db.insert(users).values({ email: "it.admin@wct.my", name: "IT Admin" }).returning();
  await db.insert(roleAssignments).values({ userId: admin.id, role: "SYS_ADMIN" });
  const real = await asUser("real.staff@wct.my");
  const { id: realId } = await createDraft(real, validDraft);
  const att = await saveAttachment(real, realId, { name: "quote.pdf", type: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 quote") });
  await performAction(real, { requestId: realId, version: 1, type: "SUBMIT" });
  const demo = await asUser("requester@demo.wct.my");
  const { id: demoId } = await createDraft(demo, validDraft);
  await performAction(demo, { requestId: demoId, version: 1, type: "SUBMIT" });
  return { realId, demoId, attId: att.id, admin: await asUser("it.admin@wct.my") };
}

describe("demo accounts see demo requests only", () => {
  it("a demo HOD's inbox and dashboard leave out real staff requests", async () => {
    const { realId, demoId } = await setup();
    const hod = await asUser("hod.land@demo.wct.my");
    const d = await getDashboard(hod);
    expect(d.awaitingIds).toContain(demoId);
    expect(d.awaitingIds).not.toContain(realId);
    expect(d.board.map((b) => b.id)).not.toContain(realId);
  });

  it("a demo HR Head (who normally sees everything) can't find, open or download real requests", async () => {
    const { realId, demoId, attId } = await setup();
    const hr = await asUser("hrhead@demo.wct.my");
    const ids = (await searchHistory(hr, parseHistoryFilters({ pageSize: "100" }))).rows.map((r) => r.id);
    expect(ids).toContain(demoId);
    expect(ids).not.toContain(realId);
    expect(await getRequestForUser(hr, realId)).toBeNull();
    expect(await getRequestForUser(hr, demoId)).not.toBeNull();
    expect(await readAttachment(hr, attId)).toBeNull();
  });

  it("demo analytics leave out real requests; real staff still see everything", async () => {
    const { realId, admin } = await setup();
    await db.update(trainingRequests).set({ status: "APPROVED", finalisedAt: new Date() }).where(eq(trainingRequests.id, realId));
    const year = new Date().getFullYear();
    const demoView = await getReports(await asUser("lnd1@demo.wct.my"), { year });
    const realView = await getReports(admin, { year });
    expect(realView.totals.submitted).toBe(demoView.totals.submitted + 1);
    expect(realView.totals.approved).toBe(demoView.totals.approved + 1);
    const realStillSees = (await searchHistory(admin, parseHistoryFilters({ pageSize: "100" }))).rows.map((r) => r.id);
    expect(realStillSees).toContain(realId);
  });

  it("a demo approver can't act on a real request", async () => {
    const { realId } = await setup();
    const hod = await asUser("hod.land@demo.wct.my");
    await expect(performAction(hod, { requestId: realId, version: 2, type: "APPROVE" })).rejects.toThrow(/demo requests/);
  });
});
