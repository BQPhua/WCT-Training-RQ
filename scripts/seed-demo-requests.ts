/**
 * DEV/DEMO ONLY: creates ~30 synthetic training requests across all statuses
 * using the real workflow service (so audit trails are genuine).
 * Usage: npx tsx scripts/seed-demo-requests.ts
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../src/db";
import { users } from "../src/db/schema";
import { loadCurrentUser } from "../src/lib/auth/load-user";
import { createDraft, performAction, setNotifier } from "../src/lib/services/requests";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo requests in production");
setNotifier(async () => {});

const TRAININGS = [
  ["Advanced Contract Administration (PAM 2018)", "CIDB Academy", "1450.00"],
  ["Project Scheduling with Primavera P6", "Projek Akademi Sdn Bhd", "2200.00"],
  ["Occupational Safety & Health Coordinator", "NIOSH Malaysia", "1800.00"],
  ["Building Information Modelling (BIM) Fundamentals", "myBIM Centre", "950.00"],
  ["Retail Leasing Negotiation Masterclass", "PPK Malaysia", "1200.00"],
  ["Customer Service Excellence for Mall Teams", "Service Academy Asia", "480.00"],
  ["Power BI for Business Reporting", "Excel Pro Training", "890.00"],
  ["Leadership Essentials for New Managers", "Leaderonomics", "2600.00"],
  ["Property Sales Closing Techniques", "REHDA Institute", "750.00"],
  ["Fire Safety & Emergency Response", "Bomba Training Centre", "300.00"],
  ["Quantity Surveying: Measurement Standards", "RISM", "1100.00"],
  ["Facilities Energy Management", "Malaysian Green Building Council", "1350.00"],
] as const;

const REQUESTERS = ["requester@demo.wct.my", "requester.malls@demo.wct.my", "buadmin.land@demo.wct.my", "buadmin.enc@demo.wct.my", "hod.enc@demo.wct.my"];
const PLAN: string[][] = [
  ["SUBMIT"], ["SUBMIT"], ["SUBMIT", "HOD"], ["SUBMIT", "HOD"], ["SUBMIT", "HOD", "LND"],
  ["SUBMIT", "HOD", "LND", "HR"], ["SUBMIT", "HOD", "LND", "HR"], ["SUBMIT", "HOD", "LND", "HR"], ["SUBMIT", "HOD", "LND", "HR"],
  ["SUBMIT", "HOD_REJECT"], ["SUBMIT", "HOD", "LND_REJECT"], ["SUBMIT", "CANCEL"], ["SUBMIT", "HOD", "LND", "HR"], ["SUBMIT", "HOD", "LND", "HR_REJECT_LND"],
];
const HOD_OF: Record<string, string> = {
  "requester@demo.wct.my": "hod.land@demo.wct.my",
  "buadmin.land@demo.wct.my": "hod.land@demo.wct.my",
  "requester.malls@demo.wct.my": "hod.malls@demo.wct.my",
  "buadmin.enc@demo.wct.my": "hod.enc@demo.wct.my",
  "hod.enc@demo.wct.my": "hod.enc@demo.wct.my",
};

async function as(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return (await loadCurrentUser(u.id))!;
}

async function main() {
  let n = 0;
  for (let i = 0; i < 30; i++) {
    const reqEmail = REQUESTERS[i % REQUESTERS.length];
    const requester = await as(reqEmail);
    const [title, provider, fee] = TRAININGS[i % TRAININGS.length];
    const start = new Date(2026, 9 + (i % 4), 3 + (i % 20));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const { id } = await createDraft(requester, {
      trainingType: i % 3 === 0 ? "ADHOC" : "PLANNED",
      title,
      objective: `Equip the team with practical skills in ${title.toLowerCase()} to improve delivery quality and compliance.`,
      startDate: iso(start),
      endDate: iso(new Date(start.getTime() + (i % 3) * 86400000)),
      startTime: "09:00",
      endTime: "17:00",
      feePerPax: fee,
      venue: i % 2 ? "WCT Tower, Level 12 Training Room" : "Online (Microsoft Teams)",
      conductedBy: provider,
      candidates: [
        { name: requester.name, email: requester.email },
        ...(i % 2 ? [{ name: "Muhammad Hafiz bin Ali" }, { name: "Chong Li Ying" }] : [{ name: "Siti Aminah binti Yusof" }]),
      ],
    });
    let version = 1;
    const step = async (email: string, input: Record<string, unknown>) => {
      const r = await performAction(await as(email), { requestId: id, version, ...input } as never);
      version = r.version;
    };
    for (const s of PLAN[i % PLAN.length]) {
      if (s === "SUBMIT") await step(reqEmail, { type: "SUBMIT" });
      if (s === "HOD") await step(HOD_OF[reqEmail], { type: "APPROVE" });
      if (s === "LND") await step(i % 2 ? "lnd1@demo.wct.my" : "lnd2@demo.wct.my", { type: "APPROVE", remark: "HRD Corp claimable under SBL-Khas." });
      if (s === "HR") await step("hrhead@demo.wct.my", { type: "APPROVE" });
      if (s === "HOD_REJECT") await step(HOD_OF[reqEmail], { type: "REJECT", remark: "Please reduce to two candidates and confirm the dates with the project schedule." });
      if (s === "LND_REJECT") await step("lnd1@demo.wct.my", { type: "REJECT", remark: "Provider quotation missing — please attach it.", sendBackTo: "REQUESTER", notify: ["HOD"] });
      if (s === "CANCEL") await step(reqEmail, { type: "CANCEL", remark: "Project deadline moved; will re-apply next quarter." });
      if (s === "HR_REJECT_LND") await step("hrhead@demo.wct.my", { type: "REJECT", remark: "L&D please verify HRD Corp eligibility before final approval.", sendBackTo: "LND" });
    }
    n++;
  }
  // Spread demo requests over Jan–Oct with realistic gaps between workflow steps,
  // so the availability board's month rows and stage-turnaround report have shape.
  await db.execute(sql`
    with req as (
      select id, row_number() over (order by created_at) - 1 as i from training_requests
    ), base as (
      -- newest request ~6 days ago, then one every ~9 days back towards January (never in the future)
      select id, date_trunc('hour', now()) - interval '6 days' - (29 - i) * interval '9 days' as t0 from req
    ), steps as (
      select a.id, b.t0 + (row_number() over (partition by a.request_id order by a.created_at) - 1) * interval '19 hours' as t
      from request_actions a join base b on b.id = a.request_id
    )
    update request_actions ra set created_at = steps.t from steps where steps.id = ra.id
  `);
  await db.execute(sql`
    update training_requests tr set
      created_at = x.first_at,
      submitted_at = case when tr.submitted_at is null then null else x.submit_at end,
      finalised_at = case when tr.finalised_at is null then null else x.last_at end,
      updated_at = x.last_at
    from (
      select request_id, min(created_at) as first_at, max(created_at) as last_at,
             max(created_at) filter (where action in ('SUBMIT','RESUBMIT')) as submit_at
      from request_actions group by request_id
    ) x where x.request_id = tr.id
  `);
  await db.execute(sql`update request_revisions rv set created_at = tr.submitted_at from training_requests tr where tr.id = rv.request_id and tr.submitted_at is not null`);
  console.log(`Created ${n} demo requests.`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
