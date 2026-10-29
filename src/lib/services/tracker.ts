import type { TrackerStation } from "@/components/request-detail/progress-tracker";
import type { RequestDetail } from "./requests";

/** Derive tracker stations from the request's status and its audit trail. */
export function buildStations(d: RequestDetail, holders: { hod: string | null; bu?: string | null; hr: string | null }): TrackerStation[] {
  const s = d.request.status;
  const acts = d.actions;
  const lastOf = (pred: (a: (typeof acts)[number]) => boolean) => [...acts].reverse().find(pred);
  const submitted = lastOf((a) => a.action === "SUBMIT" || a.action === "RESUBMIT");
  const approvedFrom = (from: string) => lastOf((a) => a.action === "APPROVE" && a.fromStatus === from);
  const order = ["PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR", "APPROVED"];
  const pos = order.indexOf(s);

  const stage = (key: string, label: string, from: string, idx: number, holder: string | null): TrackerStation => {
    const act = approvedFrom(from);
    if (s === "CANCELLED") return { key, label, state: act && act.createdAt > (submitted?.createdAt ?? new Date(0)) ? "done" : "upcoming", who: act?.actor.name, when: act?.createdAt };
    if (pos > idx) return { key, label, state: "done", who: act?.actor.name, when: act?.createdAt };
    if (pos === idx) return { key, label, state: "current", who: holder ?? undefined };
    return { key, label, state: "upcoming", who: holder ?? undefined };
  };

  const first: TrackerStation =
    s === "DRAFT"
      ? { key: "submit", label: "Draft", state: "current", who: d.requester.name }
      : s === "RETURNED"
        ? { key: "submit", label: "Returned to requester", state: "returned", who: d.requester.name, when: lastOf((a) => a.action === "REJECT")?.createdAt }
        : { key: "submit", label: "Submitted", state: "done", who: d.requester.name, when: submitted?.createdAt };

  const last: TrackerStation =
    s === "APPROVED"
      ? { key: "final", label: "Approved", state: "done", when: d.request.finalisedAt }
      : s === "CANCELLED"
        ? { key: "final", label: "Cancelled", state: "cancelled", when: d.request.finalisedAt }
        : { key: "final", label: "Approved", state: "upcoming" };

  // Land and Malls end at L&D. Keep the HR Head station when the unit needs it, or when this
  // request is actually with (or was approved by) HR Head, e.g. one in flight when the rule changed.
  const hrApprovedThisRound = acts.some(
    (a) => a.action === "APPROVE" && a.fromStatus === "PENDING_HR" && a.createdAt >= (submitted?.createdAt ?? new Date(0)),
  );
  const showHr = (d.businessUnit?.requiresHrApproval ?? true) || s === "PENDING_HR" || hrApprovedThisRound;

  return [
    first,
    stage("hod", "Department HOD", "PENDING_HOD", 0, holders.hod),
    stage("bu", "BU Admin", "PENDING_BU", 1, holders.bu ?? "BU Admin"),
    stage("lnd", "L&D review", "PENDING_LND", 2, "L&D Team"),
    ...(showHr ? [stage("hr", "HR Head", "PENDING_HR", 3, holders.hr)] : []),
    last,
  ];
}
