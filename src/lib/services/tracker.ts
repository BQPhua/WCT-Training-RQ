import type { TrackerStation } from "@/components/request-detail/progress-tracker";
import { routeOf } from "@/lib/workflow/route";
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

  // Which approval stations to draw. A finished request shows the route it actually took
  // (the stages approved this round); an open one shows its unit's route, plus the stage it is
  // at and any it has passed (so an in-flight request at a step since switched off is not hidden).
  const since = submitted?.createdAt ?? new Date(0);
  const approvedThisRound = new Set(acts.filter((a) => a.action === "APPROVE" && a.createdAt >= since).map((a) => a.fromStatus));
  const STAGES = [
    { key: "hod", label: "Department HOD", status: "PENDING_HOD", stage: "HOD", holder: holders.hod },
    { key: "bu", label: "BU Admin", status: "PENDING_BU", stage: "BU", holder: holders.bu ?? "BU Admin" },
    { key: "lnd", label: "L&D review", status: "PENDING_LND", stage: "LND", holder: "L&D Team" },
    { key: "hr", label: "HR Head", status: "PENDING_HR", stage: "HR", holder: holders.hr },
  ] as const;
  const route = new Set<string>(routeOf({ requiresBuAdmin: d.businessUnit?.requiresBuAdmin, requiresHrApproval: d.businessUnit?.requiresHrApproval }));
  const shown = STAGES.filter((st) =>
    s === "APPROVED" ? approvedThisRound.has(st.status) : route.has(st.stage) || s === st.status || approvedThisRound.has(st.status),
  );

  return [first, ...shown.map((st) => stage(st.key, st.label, st.status, order.indexOf(st.status), st.holder)), last];
}
