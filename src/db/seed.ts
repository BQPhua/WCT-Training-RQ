import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { businessUnitAdmins, businessUnits, departments, roleAssignments, users } from "./schema";

export const SEED_BUSINESS_UNITS = [
  { code: "LAND", name: "Land" },
  { code: "ENC", name: "E&C" },
  { code: "MALLS", name: "Malls" },
] as const;

export const SEED_DEPARTMENTS: { name: string; bu: string }[] = [
  { name: "Land – Project Management", bu: "LAND" },
  { name: "Land – Sales & Marketing", bu: "LAND" },
  { name: "E&C – Engineering", bu: "ENC" },
  { name: "E&C – QS & Contracts", bu: "ENC" },
  { name: "Malls – Operations", bu: "MALLS" },
  { name: "Malls – Leasing", bu: "MALLS" },
  { name: "Group HR & Admin", bu: "ENC" },
];

type DemoUser = {
  email: string;
  name: string;
  jobTitle: string;
  dept: string;
  roles?: ("LND" | "HR_HEAD" | "SYS_ADMIN")[];
  hodOf?: string[];
  buAdminOf?: string[];
};

/** Demo accounts for local development and end-to-end tests only. */
export const DEMO_USERS: DemoUser[] = [
  { email: "requester@demo.wct.my", name: "Aisyah Rahman", jobTitle: "Project Engineer", dept: "Land – Project Management" },
  { email: "requester.malls@demo.wct.my", name: "Daniel Lim", jobTitle: "Mall Executive", dept: "Malls – Operations" },
  { email: "hod.land@demo.wct.my", name: "Tan Wei Ming", jobTitle: "Head of Project Management", dept: "Land – Project Management", hodOf: ["Land – Project Management", "Land – Sales & Marketing"] },
  { email: "hod.enc@demo.wct.my", name: "Siti Nurhaliza", jobTitle: "Head of Engineering", dept: "E&C – Engineering", hodOf: ["E&C – Engineering", "E&C – QS & Contracts"] },
  { email: "hod.malls@demo.wct.my", name: "Rajesh Kumar", jobTitle: "Head of Mall Operations", dept: "Malls – Operations", hodOf: ["Malls – Operations", "Malls – Leasing"] },
  { email: "lnd1@demo.wct.my", name: "Nurul Izzah", jobTitle: "L&D Executive", dept: "Group HR & Admin", roles: ["LND"] },
  { email: "lnd2@demo.wct.my", name: "Kevin Ong", jobTitle: "L&D Manager", dept: "Group HR & Admin", roles: ["LND"] },
  { email: "hrhead@demo.wct.my", name: "Farah Hanim", jobTitle: "Head of Human Resources", dept: "Group HR & Admin", roles: ["HR_HEAD"], hodOf: ["Group HR & Admin"] },
  { email: "buadmin.land@demo.wct.my", name: "Lee Mei Ling", jobTitle: "Land BU Admin", dept: "Land – Sales & Marketing", buAdminOf: ["LAND"] },
  { email: "buadmin.enc@demo.wct.my", name: "Hafiz Osman", jobTitle: "E&C BU Admin", dept: "E&C – QS & Contracts", buAdminOf: ["ENC"] },
  { email: "buadmin.malls@demo.wct.my", name: "Priya Nair", jobTitle: "Malls BU Admin", dept: "Malls – Leasing", buAdminOf: ["MALLS"] },
  { email: "admin@demo.wct.my", name: "System Admin", jobTitle: "HRIS Administrator", dept: "Group HR & Admin", roles: ["SYS_ADMIN"] },
];

export async function seed({ demo }: { demo: boolean }) {
  // Business units
  for (const bu of SEED_BUSINESS_UNITS) {
    await db
      .insert(businessUnits)
      .values({ code: bu.code, name: bu.name })
      .onConflictDoNothing({ target: businessUnits.code });
  }
  const buRows = await db.select().from(businessUnits);
  const buId = (code: string) => buRows.find((b) => b.code === code)!.id;

  // Departments
  for (const d of SEED_DEPARTMENTS) {
    const existing = await db
      .select({ id: departments.id })
      .from(departments)
      .where(sql`lower(${departments.name}) = lower(${d.name})`);
    if (existing.length === 0) {
      await db.insert(departments).values({ name: d.name, businessUnitId: buId(d.bu) });
    }
  }

  if (!demo) return;

  const deptRows = await db.select().from(departments);
  const deptId = (name: string) => deptRows.find((d) => d.name === name)!.id;

  for (const u of DEMO_USERS) {
    const [row] = await db
      .insert(users)
      .values({ email: u.email, name: u.name, jobTitle: u.jobTitle, departmentId: deptId(u.dept) })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: u.name, jobTitle: u.jobTitle, departmentId: deptId(u.dept) },
      })
      .returning();

    for (const role of u.roles ?? []) {
      await db.insert(roleAssignments).values({ userId: row.id, role }).onConflictDoNothing();
    }
    for (const dName of u.hodOf ?? []) {
      await db.update(departments).set({ hodUserId: row.id }).where(eq(departments.id, deptId(dName)));
    }
    for (const code of u.buAdminOf ?? []) {
      await db.insert(businessUnitAdmins).values({ businessUnitId: buId(code), userId: row.id }).onConflictDoNothing();
    }
  }
}
