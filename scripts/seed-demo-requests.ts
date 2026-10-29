/**
 * DEMO ONLY: creates 10–20 synthetic training requests in 5 random months of
 * this year, across every status (incl. the BU Admin step, rejections that
 * restart at the HOD, and one Excel name list), using the real workflow
 * service so audit trails are genuine. No emails are sent.
 * Usage: npx tsx scripts/seed-demo-requests.ts
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { asc, eq, sql } from "drizzle-orm";
import { db, closeDb } from "../src/db";
import { requestActions, users } from "../src/db/schema";
import { loadCurrentUser } from "../src/lib/auth/load-user";
import { saveAttachment } from "../src/lib/services/attachments";
import { createDraft, performAction, setNotifier, updateContent } from "../src/lib/services/requests";

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

const REQUESTERS = ["requester@demo.wct.my", "requester.malls@demo.wct.my", "requester.enc@demo.wct.my"];
const HOD_OF: Record<string, string> = {
  "requester@demo.wct.my": "hod.land@demo.wct.my",
  "requester.malls@demo.wct.my": "hod.malls@demo.wct.my",
  "requester.enc@demo.wct.my": "hod.enc@demo.wct.my",
};
const BU_ADMIN_OF: Record<string, string> = {
  "requester@demo.wct.my": "buadmin.land@demo.wct.my",
  "requester.malls@demo.wct.my": "buadmin.malls@demo.wct.my",
  "requester.enc@demo.wct.my": "buadmin.enc@demo.wct.my",
};
/**
 * Every status, the BU Admin step, and rejections that restart at the HOD.
 * Requesters rotate Land, Malls, E&C, so plan i goes to REQUESTERS[i % 3]:
 * Land and Malls finish at L&D; the E&C plans (2, 5, 8) show HR Head's step.
 */
const PLANS: string[][] = [
  ["SUBMIT", "HOD", "BU", "LND"],
  ["SUBMIT"],
  ["SUBMIT", "HOD", "BU", "LND"],
  ["SUBMIT", "HOD", "BU"],
  ["SUBMIT", "HOD", "BU", "LND"],
  ["SUBMIT", "HOD", "BU", "LND", "HR"],
  ["SUBMIT", "HOD", "BU_REJECT"],
  ["SUBMIT", "HOD", "BU", "LND_REJECT", "RESUBMIT"],
  ["SUBMIT", "HOD"],
  ["SUBMIT", "CANCEL"],
];
const RELEVANCY = [
  "The team applies this daily on live projects; current skills gaps were raised in the last performance review.",
  "Required to meet client and regulatory expectations for the coming financial year.",
  "Supports the department's KPI on delivery quality and reduces rework.",
];
const NAME_LIST_SIZE = 25;
const HOUR = 3_600_000;

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function as(email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return (await loadCurrentUser(u.id))!;
}

async function nameListXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Participants");
  ws.columns = [
    { header: "Name", key: "name", width: 32 },
    { header: "Department", key: "dept", width: 28 },
  ];
  const first = ["Ahmad", "Siti", "Lim", "Kumar", "Nurul", "Tan", "Farah", "Wong", "Hafiz", "Priya"];
  const last = ["Rahman", "Abdullah", "Wei Jie", "Raj", "Aina", "Mei Ling", "Hanim", "Kah Hoe", "Osman", "Nair"];
  for (let i = 0; i < NAME_LIST_SIZE; i++) ws.addRow({ name: `${first[i % 10]} ${last[(i * 3) % 10]}`, dept: "Land – Project Management" });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Re-time one demo request so its actions fall inside `month`, never in the future. */
async function retime(requestId: string, month: Date) {
  const acts = await db
    .select({ id: requestActions.id })
    .from(requestActions)
    .where(eq(requestActions.requestId, requestId))
    .orderBy(asc(requestActions.createdAt));
  const span = (acts.length - 1) * 19 * HOUR;
  const monthStart = month.getTime();
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() - 1;
  const latest = Math.min(monthEnd, Date.now() - span - 2 * HOUR);
  const base = latest <= monthStart ? Math.min(monthStart, Date.now() - span - 2 * HOUR) : randInt(monthStart, latest);
  for (const [k, a] of acts.entries()) {
    await db.update(requestActions).set({ createdAt: new Date(base + k * 19 * HOUR) }).where(eq(requestActions.id, a.id));
  }
  await db.execute(sql`
    update training_requests tr set
      created_at = x.first_at,
      submitted_at = case when tr.submitted_at is null then null else x.submit_at end,
      finalised_at = case when tr.finalised_at is null then null else x.last_at end,
      updated_at = x.last_at
    from (
      select request_id, min(created_at) as first_at, max(created_at) as last_at,
             max(created_at) filter (where action in ('SUBMIT','RESUBMIT')) as submit_at
      from request_actions where request_id = ${requestId} group by request_id
    ) x where x.request_id = tr.id
  `);
  await db.execute(sql`update request_revisions rv set created_at = tr.submitted_at from training_requests tr where tr.id = rv.request_id and tr.id = ${requestId} and tr.submitted_at is not null`);
}

async function main() {
  const now = new Date();
  const total = randInt(10, 20);
  const monthsSoFar = Array.from({ length: now.getMonth() + 1 }, (_, m) => new Date(now.getFullYear(), m, 1));
  const months = shuffle(monthsSoFar).slice(0, Math.min(5, monthsSoFar.length)).sort((a, b) => a.getTime() - b.getTime());
  const listFile = await nameListXlsx();

  for (let i = 0; i < total; i++) {
    const reqEmail = REQUESTERS[i % REQUESTERS.length];
    const requester = await as(reqEmail);
    const [title, provider, fee] = TRAININGS[i % TRAININGS.length];
    const month = months[i % months.length];
    const start = new Date(month.getFullYear(), month.getMonth() + 1, randInt(3, 24));
    const withNameList = i === 0;
    const { id } = await createDraft(requester, {
      trainingType: i % 3 === 0 ? "ADHOC" : "PLANNED",
      title,
      objective: `Equip the team with practical skills in ${title.toLowerCase()} to improve delivery quality and compliance.`,
      relevancy: RELEVANCY[i % RELEVANCY.length],
      startDate: iso(start),
      endDate: iso(new Date(start.getTime() + (i % 3) * 86_400_000)),
      startTime: "09:00",
      endTime: "17:00",
      feePerPax: fee,
      venue: i % 2 ? "WCT Tower, Level 12 Training Room" : "Online (Microsoft Teams)",
      conductedBy: provider,
      candidates: withNameList
        ? []
        : [
            { name: requester.name },
            ...(i % 2 ? [{ name: "Muhammad Hafiz bin Ali" }, { name: "Chong Li Ying" }] : [{ name: "Siti Aminah binti Yusof" }]),
          ],
    });
    let version = 1;
    if (withNameList) {
      await saveAttachment(requester, id, { name: "participants.xlsx", type: "", bytes: listFile }, "NAME_LIST");
      version = (await updateContent(requester, id, version, {
        title,
        relevancy: RELEVANCY[0],
        candidates: [],
        participantCount: NAME_LIST_SIZE,
        trainingType: "PLANNED",
        objective: `Equip the team with practical skills in ${title.toLowerCase()} to improve delivery quality and compliance.`,
        startDate: iso(start),
        endDate: iso(start),
        startTime: "09:00",
        endTime: "17:00",
        feePerPax: fee,
        venue: "WCT Tower, Level 12 Training Room",
        conductedBy: provider,
      })).version;
    }
    const step = async (email: string, input: Record<string, unknown>) => {
      const r = await performAction(await as(email), { requestId: id, version, ...input } as never);
      version = r.version;
    };
    for (const s of PLANS[i % PLANS.length]) {
      if (s === "SUBMIT") await step(reqEmail, { type: "SUBMIT" });
      if (s === "RESUBMIT") await step(reqEmail, { type: "RESUBMIT" });
      if (s === "HOD") await step(HOD_OF[reqEmail], { type: "APPROVE" });
      if (s === "BU") await step(BU_ADMIN_OF[reqEmail], { type: "APPROVE" });
      if (s === "LND") await step(i % 2 ? "lnd1@demo.wct.my" : "lnd2@demo.wct.my", { type: "APPROVE", remark: "HRD Corp claimable under SBL-Khas." });
      if (s === "HR") await step("hrhead@demo.wct.my", { type: "APPROVE" });
      if (s === "BU_REJECT") await step(BU_ADMIN_OF[reqEmail], { type: "REJECT", remark: "Not in this year's BU training budget — please align with the BU plan and resubmit." });
      if (s === "LND_REJECT") await step("lnd1@demo.wct.my", { type: "REJECT", remark: "Provider quotation missing — please attach it." });
      if (s === "CANCEL") await step(reqEmail, { type: "CANCEL", remark: "Project deadline moved; will re-apply next quarter." });
    }
    await retime(id, month);
  }
  console.log(`Created ${total} demo requests across ${months.map((m) => m.toLocaleString("en-MY", { month: "short" })).join(", ")}.`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
