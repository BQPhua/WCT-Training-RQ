import { describe, expect, it } from "vitest";
import { resolveRecipients, type WorkflowEvent } from "@/lib/workflow";
import { P, parties } from "./fixtures";

const emails = (ps: { email: string }[]) => ps.map((p) => p.email).sort();

function ev(e: Partial<WorkflowEvent> & Pick<WorkflowEvent, "kind" | "fromStatus">): WorkflowEvent {
  return { actorId: "someone-else", ...e };
}

describe("resolveRecipients", () => {
  it("SUBMITTED → HOD, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "SUBMITTED", fromStatus: "DRAFT", actorId: P.requester.id }), parties);
    expect(emails(r.to)).toEqual([P.hod.email]);
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("HOD_APPROVED → L&D team and BU Admin, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "HOD_APPROVED", fromStatus: "PENDING_HOD", actorId: P.hod.id }), parties);
    expect(emails(r.to)).toEqual(emails([P.lnd1, P.lnd2, P.bua]));
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("LND_APPROVED → HR Head, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "LND_APPROVED", fromStatus: "PENDING_LND", actorId: P.lnd1.id }), parties);
    expect(emails(r.to)).toEqual([P.hr.email]);
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("FINAL_APPROVED → requester, cc HOD, L&D, BU Admin (actor excluded from to only)", () => {
    const r = resolveRecipients(ev({ kind: "FINAL_APPROVED", fromStatus: "PENDING_HR", actorId: P.hr.id }), parties);
    expect(emails(r.to)).toEqual([P.requester.email]);
    expect(emails(r.cc)).toEqual(emails([P.hod, P.lnd1, P.lnd2, P.bua]));
  });

  it("REJECTED by HR back to L&D with notify=[REQUESTER] → L&D (target), requester, BU Admin (always)", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_HR", byStage: "HR", sentBackTo: "LND", notify: ["REQUESTER"], actorId: P.hr.id }),
      parties,
    );
    expect(emails(r.to)).toEqual(emails([P.lnd1, P.lnd2, P.requester, P.bua]));
  });

  it("REJECTED by HOD → requester and BU Admin", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_HOD", byStage: "HOD", sentBackTo: "REQUESTER", actorId: P.hod.id }),
      parties,
    );
    expect(emails(r.to)).toEqual(emails([P.requester, P.bua]));
  });

  it("REJECTED by L&D with notify=[HOD,LND] → requester, HOD, other L&D member, BU Admin; actor excluded", () => {
    const r = resolveRecipients(
      ev({
        kind: "REJECTED",
        fromStatus: "PENDING_LND",
        byStage: "LND",
        sentBackTo: "REQUESTER",
        notify: ["HOD", "LND"],
        actorId: P.lnd1.id,
      }),
      parties,
    );
    expect(emails(r.to)).toEqual(emails([P.requester, P.hod, P.lnd2, P.bua]));
  });

  it("CANCELLED while pending L&D → L&D team and BU Admin", () => {
    const r = resolveRecipients(ev({ kind: "CANCELLED", fromStatus: "PENDING_LND", actorId: P.requester.id }), parties);
    expect(emails(r.to)).toEqual(emails([P.lnd1, P.lnd2, P.bua]));
  });

  it("CANCELLED from draft notifies nobody", () => {
    const r = resolveRecipients(ev({ kind: "CANCELLED", fromStatus: "DRAFT", actorId: P.requester.id }), parties);
    expect(r.to).toEqual([]);
    expect(r.cc).toEqual([]);
  });

  it("COMMENTED → requester and current stage owners, minus the author", () => {
    const r = resolveRecipients(ev({ kind: "COMMENTED", fromStatus: "PENDING_HR", actorId: P.requester.id }), parties);
    expect(emails(r.to)).toEqual([P.hr.email]);
  });

  it("deduplicates recipients by email (case-insensitive)", () => {
    const dup = { ...parties, buAdmins: [{ ...P.hod, email: P.hod.email.toUpperCase() }] };
    const r = resolveRecipients(ev({ kind: "REJECTED", fromStatus: "PENDING_HR", byStage: "HR", sentBackTo: "HOD", actorId: P.hr.id }), dup);
    expect(r.to.length).toBe(1);
  });

  it("missing HOD is skipped without error", () => {
    const r = resolveRecipients(ev({ kind: "SUBMITTED", fromStatus: "DRAFT" }), { ...parties, hod: null });
    expect(r.to).toEqual([]);
  });
});
