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

  it("HOD_APPROVED → BU Admins, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "HOD_APPROVED", fromStatus: "PENDING_HOD", actorId: P.hod.id }), parties);
    expect(emails(r.to)).toEqual([P.bua.email]);
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("BU_APPROVED → L&D team, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "BU_APPROVED", fromStatus: "PENDING_BU", actorId: P.bua.id }), parties);
    expect(emails(r.to)).toEqual(emails([P.lnd1, P.lnd2]));
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("LND_APPROVED → HR Head, cc requester", () => {
    const r = resolveRecipients(ev({ kind: "LND_APPROVED", fromStatus: "PENDING_LND", actorId: P.lnd1.id }), parties);
    expect(emails(r.to)).toEqual([P.hr.email]);
    expect(emails(r.cc)).toEqual([P.requester.email]);
  });

  it("FINAL_APPROVED → requester, cc HOD, BU Admin, L&D", () => {
    const r = resolveRecipients(ev({ kind: "FINAL_APPROVED", fromStatus: "PENDING_HR", actorId: P.hr.id }), parties);
    expect(emails(r.to)).toEqual([P.requester.email]);
    expect(emails(r.cc)).toEqual(emails([P.hod, P.lnd1, P.lnd2, P.bua]));
  });

  it("REJECTED by HR → requester, cc everyone who approved this round", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_HR", byStage: "HR", sentBackTo: "REQUESTER", actorId: P.hr.id }),
      { ...parties, roundApprovers: [P.hod, P.bua, P.lnd1] },
    );
    expect(emails(r.to)).toEqual([P.requester.email]);
    expect(emails(r.cc)).toEqual(emails([P.hod, P.bua, P.lnd1]));
  });

  it("REJECTED by BU Admin → requester, cc the HOD who approved", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_BU", byStage: "BU", sentBackTo: "REQUESTER", actorId: P.bua.id }),
      { ...parties, roundApprovers: [P.hod] },
    );
    expect(emails(r.to)).toEqual([P.requester.email]);
    expect(emails(r.cc)).toEqual([P.hod.email]);
  });

  it("REJECTED by HOD → requester only", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_HOD", byStage: "HOD", sentBackTo: "REQUESTER", actorId: P.hod.id }),
      parties,
    );
    expect(emails(r.to)).toEqual([P.requester.email]);
    expect(r.cc).toEqual([]);
  });

  it("CANCELLED while pending BU Admin → BU Admins", () => {
    const r = resolveRecipients(ev({ kind: "CANCELLED", fromStatus: "PENDING_BU", actorId: P.requester.id }), parties);
    expect(emails(r.to)).toEqual([P.bua.email]);
  });

  it("CANCELLED while pending L&D → L&D team", () => {
    const r = resolveRecipients(ev({ kind: "CANCELLED", fromStatus: "PENDING_LND", actorId: P.requester.id }), parties);
    expect(emails(r.to)).toEqual(emails([P.lnd1, P.lnd2]));
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
    const dup = { ...parties, buAdmins: [P.bua, { ...P.bua, id: "x", email: P.bua.email.toUpperCase() }] };
    const r = resolveRecipients(ev({ kind: "HOD_APPROVED", fromStatus: "PENDING_HOD", actorId: P.hod.id }), dup);
    expect(r.to.length).toBe(1);
  });

  it("missing HOD is skipped without error", () => {
    const r = resolveRecipients(ev({ kind: "SUBMITTED", fromStatus: "DRAFT" }), { ...parties, hod: null });
    expect(r.to).toEqual([]);
  });

  it("REJECTED never copies the rejecting approver, even if they approved earlier in the round", () => {
    const r = resolveRecipients(
      ev({ kind: "REJECTED", fromStatus: "PENDING_BU", byStage: "BU", sentBackTo: "REQUESTER", actorId: P.hod.id }),
      { ...parties, roundApprovers: [P.hod] },
    );
    expect(r.cc).toEqual([]);
  });
});
