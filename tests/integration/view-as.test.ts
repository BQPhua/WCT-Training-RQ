import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, roleAssignments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { ServiceError } from "@/lib/services/errors";
import { listDemoAccounts, resolveViewAs, startViewAs, stopViewAs } from "@/lib/services/view-as";
import { asUser } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
});

async function realAdmin() {
  const [u] = await db.insert(users).values({ email: "phua@wct.my", name: "Phua" }).returning();
  await db.insert(roleAssignments).values({ userId: u.id, role: "SYS_ADMIN" });
  return asUser("phua@wct.my");
}
const idOf = async (email: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id;

describe("view as demo user", () => {
  it("an admin viewing as a demo HOD gets that HOD's permissions, marked viewedBy", async () => {
    const admin = await realAdmin();
    const hodId = await idOf("hod.land@demo.wct.my");
    const u = await resolveViewAs(admin.id, hodId);
    expect(u!.id).toBe(hodId);
    expect(u!.actor.hodDepartmentIds.length).toBeGreaterThan(0);
    expect(u!.actor.roles).not.toContain("SYS_ADMIN");
    expect(u!.viewedBy).toEqual({ id: admin.id, name: "Phua" });
  });

  it("a non-admin cannot start viewing as someone else", async () => {
    const staff = await asUser("requester@demo.wct.my");
    await expect(startViewAs(staff, await idOf("hod.land@demo.wct.my"))).rejects.toBeInstanceOf(ServiceError);
  });

  it("only demo accounts can be viewed", async () => {
    const admin = await realAdmin();
    const [real] = await db.insert(users).values({ email: "real.person@wct.my", name: "Real Person" }).returning();
    await expect(startViewAs(admin, real.id)).rejects.toThrow("Only demo accounts can be viewed.");
    expect((await resolveViewAs(admin.id, real.id))!.id).toBe(admin.id);
  });

  it("a non-admin session carrying a view-as id still resolves to the user themself", async () => {
    const staff = await asUser("requester@demo.wct.my");
    expect((await resolveViewAs(staff.id, await idOf("hod.land@demo.wct.my")))!.id).toBe(staff.id);
  });

  it("falls back to the admin when the demo user was deleted or deactivated", async () => {
    const admin = await realAdmin();
    const hodId = await idOf("hod.land@demo.wct.my");
    await db.update(users).set({ isActive: false }).where(eq(users.id, hodId));
    expect((await resolveViewAs(admin.id, hodId))!.id).toBe(admin.id);
    expect((await resolveViewAs(admin.id, "7d0f3c1e-1b2a-4c3d-8e9f-001122334455"))!.id).toBe(admin.id);
  });

  it("start and stop are written to the admin audit log", async () => {
    const admin = await realAdmin();
    await startViewAs(admin, await idOf("buadmin.land@demo.wct.my"));
    await stopViewAs(admin);
    const rows = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.actorId, admin.id));
    expect(rows.map((r) => (r.change as { op: string }).op).sort()).toEqual(["view-as-start", "view-as-stop"]);
  });

  it("lists demo accounts with role labels", async () => {
    const list = await listDemoAccounts();
    const label = (email: string) => list.find((a) => a.email === email)?.roleLabel;
    expect(label("requester@demo.wct.my")).toBe("Requester");
    expect(label("hod.land@demo.wct.my")).toBe("Department HOD");
    expect(label("buadmin.land@demo.wct.my")).toBe("BU Admin");
    expect(label("lnd1@demo.wct.my")).toBe("L&D Team (System Admin)");
    expect(label("hrhead@demo.wct.my")).toBe("Department HOD · HR Head");
    expect(list.every((a) => a.email.endsWith("@demo.wct.my"))).toBe(true);
  });
});

describe("view as: demo accounts act on demo requests only", () => {
  it("an admin viewing as the demo HR Head cannot act on a real staff request, but can on a demo one", async () => {
    const { createDraft, performAction, setNotifier, updateLndFields, addComment } = await import("@/lib/services/requests");
    const { validDraft } = await import("./helpers");
    const { trainingRequests, departments } = await import("@/db/schema");
    setNotifier(async () => {});
    const admin = await realAdmin();
    // A real staff member in a demo department (shares the demo HOD/BU Admin).
    const [dept] = await db.select().from(departments).where(eq(departments.name, "Land – Project Management"));
    await db.insert(users).values({ email: "real.staff@wct.my", name: "Real Staff", departmentId: dept.id });
    const real = await asUser("real.staff@wct.my");
    const { id: realId } = await createDraft(real, validDraft);
    await performAction(real, { requestId: realId, version: 1, type: "SUBMIT" });
    const asHod = (await resolveViewAs(admin.id, await idOf("hod.land@demo.wct.my")))!;
    const v = (await db.select({ v: trainingRequests.version }).from(trainingRequests).where(eq(trainingRequests.id, realId)))[0].v;
    await expect(performAction(asHod, { requestId: realId, version: v, type: "APPROVE" })).rejects.toThrow(
      "While viewing as a demo user you can only act on demo requests.",
    );
    await expect(addComment(asHod, realId, "hi")).rejects.toThrow("While viewing as a demo user you can only act on demo requests.");
    await expect(updateLndFields(asHod, realId, v, { hrdcClaimable: true })).rejects.toThrow(/demo requests|L&D details/);

    const demoReq = await asUser("requester@demo.wct.my");
    const { id: demoId } = await createDraft(demoReq, validDraft);
    await performAction(demoReq, { requestId: demoId, version: 1, type: "SUBMIT" });
    const r = await performAction(asHod, { requestId: demoId, version: 2, type: "APPROVE" });
    expect(r.status).toBe("PENDING_BU");
  });
});
