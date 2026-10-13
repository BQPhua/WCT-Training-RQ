import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, roleAssignments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { syncUserFromProfile } from "@/lib/auth/sync-user";
import { loadCurrentUser } from "@/lib/auth/load-user";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: false });
});

describe("syncUserFromProfile", () => {
  it("creates the user on first sign-in and matches department case-insensitively", async () => {
    const u = await syncUserFromProfile({
      oid: "oid-1",
      email: "New.Person@WCT.my",
      name: "New Person",
      jobTitle: "Engineer",
      department: "land – project management",
    });
    expect(u.email).toBe("new.person@wct.my");
    const [dept] = await db.select().from(departments).where(eq(departments.name, "Land – Project Management"));
    expect(u.departmentId).toBe(dept.id);
  });

  it("keeps an admin-set department when Entra has no department", async () => {
    const first = await syncUserFromProfile({ oid: "oid-2", email: "a@wct.my", name: "A", department: "Malls – Leasing" });
    const again = await syncUserFromProfile({ oid: "oid-2", email: "a@wct.my", name: "A Renamed" });
    expect(again.departmentId).toBe(first.departmentId);
    expect(again.name).toBe("A Renamed");
  });

  it("keeps an admin-set department when the Entra department doesn't match any department", async () => {
    const first = await syncUserFromProfile({ oid: "oid-3", email: "b@wct.my", name: "B", department: "Malls – Leasing" });
    const again = await syncUserFromProfile({ oid: "oid-3", email: "b@wct.my", name: "B", department: "Unknown Dept" });
    expect(again.departmentId).toBe(first.departmentId);
    expect(again.entraDepartment).toBe("Unknown Dept");
  });

  it("links a pre-existing user row (created by admin or seed) by email", async () => {
    const [pre] = await db.insert(users).values({ email: "c@wct.my", name: "C" }).returning();
    const u = await syncUserFromProfile({ oid: "oid-4", email: "C@wct.my", name: "C Full" });
    expect(u.id).toBe(pre.id);
    expect(u.entraOid).toBe("oid-4");
  });

  it("grants SYS_ADMIN to bootstrap emails exactly once", async () => {
    await syncUserFromProfile({ oid: "oid-5", email: "admin@demo.wct.my", name: "Admin" });
    const u = await syncUserFromProfile({ oid: "oid-5", email: "admin@demo.wct.my", name: "Admin" });
    const roles = await db
      .select()
      .from(roleAssignments)
      .where(and(eq(roleAssignments.userId, u.id), eq(roleAssignments.role, "SYS_ADMIN")));
    expect(roles).toHaveLength(1);
  });

  it("refuses deactivated users", async () => {
    await db.insert(users).values({ email: "d@wct.my", name: "D", isActive: false });
    await expect(syncUserFromProfile({ oid: "oid-6", email: "d@wct.my", name: "D" })).rejects.toThrow(/deactivated/i);
  });
});

describe("loadCurrentUser", () => {
  it("builds the workflow actor with roles, HOD departments and BU admin units", async () => {
    await seed({ demo: true });
    const [hrhead] = await db.select().from(users).where(eq(users.email, "hrhead@demo.wct.my"));
    const cu = await loadCurrentUser(hrhead.id);
    expect(cu?.actor.roles).toEqual(["HR_HEAD"]);
    expect(cu?.actor.hodDepartmentIds).toHaveLength(1);
    expect(cu?.department?.name).toBe("Group HR & Admin");
    expect(cu?.businessUnit?.code).toBe("ENC");

    const [bua] = await db.select().from(users).where(eq(users.email, "buadmin.land@demo.wct.my"));
    const cu2 = await loadCurrentUser(bua.id);
    expect(cu2?.actor.buAdminBusinessUnitIds).toHaveLength(1);
  });

  it("returns null for an unknown or deactivated user", async () => {
    expect(await loadCurrentUser("00000000-0000-0000-0000-000000000000")).toBeNull();
    const [u] = await db.insert(users).values({ email: "e@wct.my", name: "E", isActive: false }).returning();
    expect(await loadCurrentUser(u.id)).toBeNull();
  });
});
