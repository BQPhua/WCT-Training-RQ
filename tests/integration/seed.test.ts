import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { businessUnits, departments, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
});

describe("seed", () => {
  it("creates the three business units LAND, ENC and MALLS", async () => {
    await seed({ demo: false });
    const bus = await db.select().from(businessUnits);
    expect(bus.map((b) => b.code).sort()).toEqual(["ENC", "LAND", "MALLS"]);
    expect(bus.find((b) => b.code === "ENC")?.name).toBe("E&C");
  });

  it("is idempotent", async () => {
    await seed({ demo: true });
    const counts1 = [
      (await db.select().from(businessUnits)).length,
      (await db.select().from(departments)).length,
      (await db.select().from(users)).length,
    ];
    await seed({ demo: true });
    const counts2 = [
      (await db.select().from(businessUnits)).length,
      (await db.select().from(departments)).length,
      (await db.select().from(users)).length,
    ];
    expect(counts2).toEqual(counts1);
    expect(counts1[1]).toBeGreaterThanOrEqual(7);
  });

  it("demo seed assigns the Land HOD to a Land department", async () => {
    await seed({ demo: true });
    const [dept] = await db.select().from(departments).where(
      (await import("drizzle-orm")).eq(departments.name, "Land – Project Management"),
    );
    const [hod] = await db.select().from(users).where(
      (await import("drizzle-orm")).eq(users.email, "hod.land@demo.wct.my"),
    );
    expect(dept.hodUserId).toBe(hod.id);
  });
});
