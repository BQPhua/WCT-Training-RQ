import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, departments, roleAssignments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { adminOverview, assignRole, listUsers, revokeRole, setBusinessUnitAdmins, updateUser, upsertBusinessUnit, upsertDepartment, userOptions } from "@/lib/services/admin";
import { asUser } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
});

/** A real (non-demo) System Admin; demo accounts are read-only in admin settings. */
async function admin() {
  const [u] = await db.insert(users).values({ email: "it.admin@wct.my", name: "IT Admin" }).returning();
  await db.insert(roleAssignments).values({ userId: u.id, role: "SYS_ADMIN" });
  return asUser("it.admin@wct.my");
}
const admin2 = () => asUser("it.admin@wct.my");
async function realLnd() {
  const [u] = await db.insert(users).values({ email: "lnd.real@wct.my", name: "Real L&D" }).returning();
  await db.insert(roleAssignments).values({ userId: u.id, role: "LND" });
  return asUser("lnd.real@wct.my");
}

describe("admin services", () => {
  it("refuses non-admins", async () => {
    const hr = await asUser("hrhead@demo.wct.my");
    await expect(assignRole(hr, hr.id, "SYS_ADMIN")).rejects.toThrow(/administrator/i);
  });

  it("assigns a role and writes an audit row", async () => {
    const a = await admin();
    const lnd = await asUser("requester@demo.wct.my");
    await assignRole(a, lnd.id, "LND");
    const roles = await db.select().from(roleAssignments).where(eq(roleAssignments.userId, lnd.id));
    expect(roles.map((r) => r.role)).toEqual(["LND"]);
    expect((await db.select().from(adminAuditLogs)).length).toBe(1);
  });

  it("refuses to revoke the last system admin (L&D and System Admins both count)", async () => {
    const a = await admin();
    await db.delete(roleAssignments).where(inArray(roleAssignments.role, ["LND", "SYS_ADMIN"]));
    await db.insert(roleAssignments).values({ userId: a.id, role: "SYS_ADMIN" });
    await expect(revokeRole(a, a.id, "SYS_ADMIN")).rejects.toThrow(/last system admin/i);
    const lnd = await realLnd();
    await revokeRole(a, a.id, "SYS_ADMIN"); // the L&D member keeps full access
    await expect(revokeRole(lnd, lnd.id, "LND")).rejects.toThrow(/last system admin/i);
  });

  it("demo admins don't count towards the last real admin, and the last one can't be deactivated", async () => {
    const a = await admin(); // the only real admin; demo admins/L&D still exist
    await expect(revokeRole(a, a.id, "SYS_ADMIN")).rejects.toThrow(/last system admin/i);
    const lnd = await realLnd();
    await expect(updateUser(lnd, a.id, { isActive: true })).resolves.toBeUndefined();
    await revokeRole(a, lnd.id, "LND");
    await db.insert(roleAssignments).values({ userId: lnd.id, role: "HR_HEAD" });
    await expect(updateUser(a, a.id, { isActive: false })).rejects.toThrow(/yourself/i);
    await db.insert(roleAssignments).values({ userId: lnd.id, role: "SYS_ADMIN" });
    await revokeRole(lnd, a.id, "SYS_ADMIN");
    await expect(updateUser(a, lnd.id, { isActive: false })).rejects.toThrow(/last system admin/i);
  });

  it("gives the L&D team full admin access", async () => {
    const lnd = await realLnd();
    const bu = await upsertBusinessUnit(lnd, { code: "HOSP", name: "Hospitality", isActive: true });
    expect(bu.code).toBe("HOSP");
  });

  it("keeps admin settings read-only for demo accounts, even demo admins", async () => {
    const demoAdmin = await asUser("admin@demo.wct.my");
    const demoLnd = await asUser("lnd1@demo.wct.my");
    await expect(upsertBusinessUnit(demoAdmin, { code: "HOSP", name: "Hospitality", isActive: true })).rejects.toThrow(
      "Demo accounts can look at settings but can't change them.",
    );
    await expect(assignRole(demoLnd, demoLnd.id, "HR_HEAD")).rejects.toThrow(/Demo accounts/);
  });

  it("shows demo accounts only to demo admins", async () => {
    await admin();
    const demoLnd = await asUser("lnd1@demo.wct.my");
    const people = await listUsers(demoLnd);
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((p) => p.email.endsWith("@demo.wct.my"))).toBe(true);
    const o = await adminOverview(demoLnd);
    expect(o.roles.every((r) => r.email.endsWith("@demo.wct.my"))).toBe(true);
    expect((await userOptions(demoLnd)).every((p) => p.email.endsWith("@demo.wct.my"))).toBe(true);
    expect((await userOptions(await admin2())).some((p) => p.email === "it.admin@wct.my")).toBe(true);
  });

  it("creates a department with HOD and audits it", async () => {
    const a = await admin();
    const bu = await upsertBusinessUnit(a, { code: "HOSP", name: "Hospitality", isActive: true });
    const hod = await asUser("hod.enc@demo.wct.my");
    const d = await upsertDepartment(a, { name: "Hotel Operations", businessUnitId: bu.id, hodUserId: hod.id, isActive: true });
    const [row] = await db.select().from(departments).where(eq(departments.id, d.id));
    expect(row.hodUserId).toBe(hod.id);
    expect((await db.select().from(adminAuditLogs)).length).toBe(2);
  });

  it("rejects a duplicate department name", async () => {
    const a = await admin();
    const [d] = await db.select().from(departments).limit(1);
    await expect(upsertDepartment(a, { name: d.name.toUpperCase(), businessUnitId: d.businessUnitId, hodUserId: null, isActive: true })).rejects.toThrow(/already exists/i);
  });

  it("sets BU admins and deactivates a user", async () => {
    const a = await admin();
    const [d] = await db.select().from(departments).limit(1);
    const u = await asUser("requester@demo.wct.my");
    await setBusinessUnitAdmins(a, d.businessUnitId, [u.id]);
    await updateUser(a, u.id, { isActive: false });
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.isActive).toBe(false);
  });

  it("refuses to deactivate yourself", async () => {
    const a = await admin();
    await expect(updateUser(a, a.id, { isActive: false })).rejects.toThrow(/yourself/i);
  });
});
