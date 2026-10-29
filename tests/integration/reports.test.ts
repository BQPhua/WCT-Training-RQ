import { beforeEach, describe, expect, it } from "vitest";
import { seed } from "@/db/seed";
import { createDraft, performAction, setNotifier, updateContent } from "@/lib/services/requests";
import { saveAttachment } from "@/lib/services/attachments";
import { getReports, ReportsForbiddenError } from "@/lib/services/reports";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

const year = new Date().getFullYear();

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

async function approved(email: string, hod: string, fee: string, n: number) {
  const u = await asUser(email);
  const { id } = await createDraft(u, { ...validDraft, feePerPax: fee, candidates: Array.from({ length: n }, (_, i) => ({ name: `Person ${i}` })) });
  let v = (await performAction(u, { requestId: id, version: 1, type: "SUBMIT" })).version;
  const bua = hod.replace("hod.", "buadmin.");
  // Land and Malls are finalised by L&D; E&C goes on to HR Head.
  for (const a of [hod, bua, "lnd1@demo.wct.my", "hrhead@demo.wct.my"]) {
    const r = await performAction(await asUser(a), { requestId: id, version: v, type: "APPROVE" });
    v = r.version;
    if (r.status === "APPROVED") break;
  }
}

describe("getReports", () => {
  it("sums approved spend per business unit", async () => {
    await approved("requester@demo.wct.my", "hod.land@demo.wct.my", "100.00", 2);
    await approved("requester.malls@demo.wct.my", "hod.malls@demo.wct.my", "50.00", 1);
    const r = await getReports(await asUser("hrhead@demo.wct.my"), { year });
    const fees = Object.fromEntries(r.byBU.map((b) => [b.code, b.fees]));
    expect(fees.LAND).toBe("200.00");
    expect(fees.MALLS).toBe("50.00");
    expect(r.byMonth).toHaveLength(12);
    expect(r.byType.PLANNED).toBe(2);
    expect(r.turnaround.map((t) => t.stage)).toEqual(["HOD", "BU", "LND", "HR"]);
    expect(r.statusCounts.APPROVED).toBe(2);
  });

  it("limits a BU admin to their own business unit", async () => {
    await approved("requester@demo.wct.my", "hod.land@demo.wct.my", "100.00", 2);
    await approved("requester.malls@demo.wct.my", "hod.malls@demo.wct.my", "50.00", 1);
    const r = await getReports(await asUser("buadmin.land@demo.wct.my"), { year });
    expect(r.byBU.filter((b) => b.count > 0).map((b) => b.code)).toEqual(["LAND"]);
    expect(r.totals.approvedFees).toBe("200.00");
  });

  it("is forbidden for ordinary staff", async () => {
    await expect(getReports(await asUser("requester@demo.wct.my"), { year })).rejects.toBeInstanceOf(ReportsForbiddenError);
  });

  it("counts name-list participants in approved spend", async () => {
    const u = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(u, { ...validDraft, feePerPax: "100.00", candidates: [] });
    await saveAttachment(u, id, { name: "names.csv", type: "text/csv", bytes: new TextEncoder().encode("Name\nA\n") }, "NAME_LIST");
    let v = (await updateContent(u, id, 1, { ...validDraft, feePerPax: "100.00", candidates: [], participantCount: 25 })).version;
    v = (await performAction(u, { requestId: id, version: v, type: "SUBMIT" })).version;
    for (const a of ["hod.land@demo.wct.my", "buadmin.land@demo.wct.my", "lnd1@demo.wct.my"]) v = (await performAction(await asUser(a), { requestId: id, version: v, type: "APPROVE" })).version;
    const r = await getReports(await asUser("hrhead@demo.wct.my"), { year });
    expect(r.totals.approvedFees).toBe("2500.00");
  });
});
