import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, departments, roleAssignments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { assignRole, revokeRole, setBusinessUnitAdmins, updateUser, upsertBusinessUnit, upsertDepartment } from "@/lib/services/admin";
import { asUser } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
});

const admin = () => asUser("admin@demo.wct.my");

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

  it("refuses to revoke the last system admin", async () => {
    const a = await admin();
    await expect(revokeRole(a, a.id, "SYS_ADMIN")).rejects.toThrow(/last system admin/i);
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
