import { describe, expect, it } from "vitest";
import { buildStations } from "@/lib/services/tracker";
import type { RequestDetail } from "@/lib/services/requests";

const t = (m: number) => new Date(2026, 9, 1, 9, m);
function detail(status: string, actions: { action: string; fromStatus?: string; m: number; name?: string }[]): RequestDetail {
  return {
    request: { status, finalisedAt: status === "APPROVED" || status === "CANCELLED" ? t(59) : null },
    requester: { name: "Aisyah" },
    actions: actions.map((a, i) => ({ id: String(i), action: a.action, fromStatus: a.fromStatus ?? null, createdAt: t(a.m), actor: { name: a.name ?? "X" } })),
  } as unknown as RequestDetail;
}
const states = (d: RequestDetail) => buildStations(d, { hod: "Tan", bu: "Lee", hr: "Farah" }).map((s) => s.state);

describe("buildStations", () => {
  it("stations run HOD → BU Admin → L&D → HR Head", () => {
    const d = detail("PENDING_HOD", [{ action: "SUBMIT", fromStatus: "DRAFT", m: 1 }]);
    expect(buildStations(d, { hod: "Tan", bu: "Lee", hr: "Farah" }).map((s) => s.label)).toEqual([
      "Submitted", "Department HOD", "BU Admin", "L&D review", "HR Head", "Approved",
    ]);
  });

  it("pending BU Admin: HOD done, BU current", () => {
    const d = detail("PENDING_BU", [
      { action: "SUBMIT", fromStatus: "DRAFT", m: 1 },
      { action: "APPROVE", fromStatus: "PENDING_HOD", m: 2, name: "Tan" },
    ]);
    expect(states(d)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
  });

  it("pending L&D: submitted, HOD and BU done, L&D current", () => {
    const d = detail("PENDING_LND", [
      { action: "SUBMIT", fromStatus: "DRAFT", m: 1 },
      { action: "APPROVE", fromStatus: "PENDING_HOD", m: 2, name: "Tan" },
      { action: "APPROVE", fromStatus: "PENDING_BU", m: 3, name: "Lee" },
    ]);
    expect(states(d)).toEqual(["done", "done", "done", "current", "upcoming", "upcoming"]);
    expect(buildStations(d, { hod: "Tan", bu: "Lee", hr: "Farah" })[1].who).toBe("Tan");
  });

  it("returned: first station returned, the rest upcoming", () => {
    const d = detail("RETURNED", [
      { action: "SUBMIT", fromStatus: "DRAFT", m: 1 },
      { action: "REJECT", fromStatus: "PENDING_HOD", m: 2 },
    ]);
    expect(states(d)).toEqual(["returned", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });

  it("approved: every station done", () => {
    const d = detail("APPROVED", [
      { action: "SUBMIT", fromStatus: "DRAFT", m: 1 },
      { action: "APPROVE", fromStatus: "PENDING_HOD", m: 2 },
      { action: "APPROVE", fromStatus: "PENDING_BU", m: 3 },
      { action: "APPROVE", fromStatus: "PENDING_LND", m: 4 },
      { action: "APPROVE", fromStatus: "PENDING_HR", m: 5 },
    ]);
    expect(states(d)).toEqual(["done", "done", "done", "done", "done", "done"]);
  });

  it("cancelled after HOD approval: HOD done, end cancelled", () => {
    const d = detail("CANCELLED", [
      { action: "SUBMIT", fromStatus: "DRAFT", m: 1 },
      { action: "APPROVE", fromStatus: "PENDING_HOD", m: 2 },
      { action: "CANCEL", fromStatus: "PENDING_BU", m: 3 },
    ]);
    expect(states(d)).toEqual(["done", "done", "upcoming", "upcoming", "upcoming", "cancelled"]);
  });

  it("draft: first station current", () => {
    expect(states(detail("DRAFT", [{ action: "CREATE", m: 0 }]))[0]).toBe("current");
  });
});
