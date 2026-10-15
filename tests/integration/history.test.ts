import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { seed } from "@/db/seed";
import { createDraft, performAction, setNotifier } from "@/lib/services/requests";
import { exportHistoryXlsx, parseHistoryFilters, searchHistory } from "@/lib/services/history";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

async function submitAs(email: string, over: Partial<typeof validDraft> = {}) {
  const u = await asUser(email);
  const { id } = await createDraft(u, { ...validDraft, ...over });
  await performAction(u, { requestId: id, version: 1, type: "SUBMIT" });
  return id;
}

describe("searchHistory", () => {
  it("finds a request by candidate name", async () => {
    const id = await submitAs("requester@demo.wct.my", { candidates: [{ name: "Zulkifli Hassan" }] });
    await submitAs("requester@demo.wct.my", { title: "Other", candidates: [{ name: "Someone Else" }] });
    const r = await searchHistory(await asUser("lnd1@demo.wct.my"), parseHistoryFilters({ q: "zulkifli" }));
    expect(r.rows.map((x) => x.id)).toEqual([id]);
    expect(r.total).toBe(1);
  });

  it("finds by ref no and by provider", async () => {
    await submitAs("requester@demo.wct.my", { conductedBy: "NIOSH Malaysia" });
    const lnd = await asUser("lnd1@demo.wct.my");
    expect((await searchHistory(lnd, parseHistoryFilters({ q: "niosh" }))).total).toBe(1);
    expect((await searchHistory(lnd, parseHistoryFilters({ q: `TRQ-${new Date().getFullYear()}-0001` }))).total).toBe(1);
  });

  it("never shows another BU's requests to a BU admin", async () => {
    await submitAs("requester@demo.wct.my");
    const r = await searchHistory(await asUser("buadmin.malls@demo.wct.my"), parseHistoryFilters({}));
    expect(r.total).toBe(0);
  });

  it("filters by status and paginates", async () => {
    for (let i = 0; i < 3; i++) await submitAs("requester@demo.wct.my");
    const lnd = await asUser("lnd1@demo.wct.my");
    const page = await searchHistory(lnd, parseHistoryFilters({ status: "PENDING_HOD", pageSize: "2", page: "2" }));
    expect(page.total).toBe(3);
    expect(page.rows).toHaveLength(1);
    expect((await searchHistory(lnd, parseHistoryFilters({ status: "APPROVED" }))).total).toBe(0);
  });

  it("ignores invalid filter values instead of failing", async () => {
    const f = parseHistoryFilters({ status: "HACKED", sort: "drop table", dir: "sideways", page: "-4", buId: "x" });
    expect(f.status).toBeUndefined();
    expect(f.sort).toBe("updatedAt");
    expect(f.page).toBe(1);
    expect(f.buId).toBeUndefined();
  });
});

describe("exportHistoryXlsx", () => {
  it("produces a workbook with the expected headers and a candidates sheet", async () => {
    await submitAs("requester@demo.wct.my");
    const buf = await exportHistoryXlsx(await asUser("lnd1@demo.wct.my"), parseHistoryFilters({}));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const ws = wb.getWorksheet("Training Requests")!;
    expect((ws.getRow(1).values as string[]).slice(1)).toEqual([
      "Ref No", "Status", "Requester", "Department", "Business Unit", "Type", "Title", "Training Start", "Training End",
      "Fee/Pax", "Participants", "Total Fees", "HRD Corp", "Submitted", "Finalised",
    ]);
    expect((wb.getWorksheet("Candidates")!.getRow(1).values as string[]).slice(1)).not.toContain("Staff No");
    expect(ws.rowCount).toBe(2);
    expect(wb.getWorksheet("Candidates")!.rowCount).toBe(3);
  });
});
