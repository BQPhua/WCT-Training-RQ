import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, departments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { createDraft, NoHodError, performAction, setNotifier } from "@/lib/services/requests";
import { setOwnDepartment } from "@/lib/services/profile";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

describe("setOwnDepartment (review #1)", () => {
  it("refuses when the user already has a department", async () => {
    const u = await asUser("requester.malls@demo.wct.my");
    const [land] = await db.select().from(departments).where(eq(departments.name, "Land – Sales & Marketing"));
    await expect(setOwnDepartment(u, land.id)).rejects.toThrow(/contact HR/i);
  });

  it("allows a first-time pick of an active department and audits it", async () => {
    await db.update(users).set({ departmentId: null }).where(eq(users.email, "requester@demo.wct.my"));
    const u = await asUser("requester@demo.wct.my");
    const [d] = await db.select().from(departments).where(eq(departments.name, "Land – Project Management"));
    await setOwnDepartment(u, d.id);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.departmentId).toBe(d.id);
    expect(await db.select().from(adminAuditLogs)).toHaveLength(1);
  });

  it("refuses an inactive department", async () => {
    await db.update(users).set({ departmentId: null }).where(eq(users.email, "requester@demo.wct.my"));
    const [d] = await db.select().from(departments).where(eq(departments.name, "Malls – Leasing"));
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, d.id));
    await expect(setOwnDepartment(await asUser("requester@demo.wct.my"), d.id)).rejects.toThrow(/not available/i);
  });
});

describe("submit guards (review #2)", () => {
  it("refuses submit when the department's HOD is deactivated", async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.email, "hod.land@demo.wct.my"));
    const u = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(u, validDraft);
    await expect(performAction(u, { requestId: id, version: 1, type: "SUBMIT" })).rejects.toBeInstanceOf(NoHodError);
  });

  it("refuses submit from an inactive department", async () => {
    const u0 = await asUser("requester@demo.wct.my");
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, u0.departmentId!));
    const u = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(u, validDraft);
    await expect(performAction(u, { requestId: id, version: 1, type: "SUBMIT" })).rejects.toThrow(/no longer active/i);
  });
});
