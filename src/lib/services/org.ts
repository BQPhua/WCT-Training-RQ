import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessUnits, departments } from "@/db/schema";

export async function orgOptions() {
  const [bus, depts] = await Promise.all([
    db.select({ id: businessUnits.id, name: businessUnits.name, code: businessUnits.code }).from(businessUnits).where(eq(businessUnits.isActive, true)).orderBy(asc(businessUnits.name)),
    db.select({ id: departments.id, name: departments.name, buId: departments.businessUnitId }).from(departments).orderBy(asc(departments.name)),
  ]);
  return { bus, departments: depts };
}
