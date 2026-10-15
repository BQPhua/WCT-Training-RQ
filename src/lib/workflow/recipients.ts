import { stageOf } from "./permissions";
import type { Parties, Person, Stage, WorkflowEvent } from "./types";

function ownersOf(stage: Stage | null, p: Parties): Person[] {
  switch (stage) {
    case "REQUESTER":
      return [p.requester];
    case "HOD":
      return p.hod ? [p.hod] : [];
    case "BU":
      return p.buAdmins;
    case "LND":
      return p.lnd;
    case "HR":
      return p.hrHeads;
    default:
      return [];
  }
}

function dedupe(people: Person[], exclude: Set<string> = new Set()): Person[] {
  const seen = new Set(exclude);
  const out: Person[] = [];
  for (const person of people) {
    const key = person.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(person);
  }
  return out;
}

/**
 * Who should be emailed for a workflow event (spec 2026-10-15 §1).
 * The actor is removed from `to` (and from `cc` on a rejection); anyone in `to` is removed from `cc`.
 */
export function resolveRecipients(event: WorkflowEvent, p: Parties): { to: Person[]; cc: Person[] } {
  let to: Person[] = [];
  let cc: Person[] = [];

  switch (event.kind) {
    case "SUBMITTED":
    case "RESUBMITTED":
      to = ownersOf("HOD", p);
      cc = [p.requester];
      break;
    case "HOD_APPROVED":
      to = p.buAdmins;
      cc = [p.requester];
      break;
    case "BU_APPROVED":
      to = p.lnd;
      cc = [p.requester];
      break;
    case "LND_APPROVED":
      to = p.hrHeads;
      cc = [p.requester];
      break;
    case "FINAL_APPROVED":
      to = [p.requester];
      cc = [...ownersOf("HOD", p), ...p.buAdmins, ...p.lnd];
      break;
    case "REJECTED":
      to = [p.requester];
      cc = p.roundApprovers;
      break;
    case "CANCELLED":
      if (event.fromStatus === "DRAFT") break;
      to = ownersOf(stageOf(event.fromStatus) === "REQUESTER" ? null : stageOf(event.fromStatus), p);
      break;
    case "COMMENTED":
      to = [p.requester, ...ownersOf(stageOf(event.fromStatus), p)];
      break;
  }

  const actorEmails = new Set(
    [p.requester, p.hod, ...p.lnd, ...p.hrHeads, ...p.buAdmins]
      .filter((x): x is Person => !!x && x.id === event.actorId)
      .map((x) => x.email.toLowerCase()),
  );
  const toFinal = dedupe(to, actorEmails);
  // The requester is still copied on their own submission; a rejecting approver is never copied on their own rejection.
  const ccExclude = event.kind === "REJECTED" ? [...actorEmails] : [];
  const ccFinal = dedupe(cc, new Set([...ccExclude, ...toFinal.map((x) => x.email.toLowerCase())]));
  return { to: toFinal, cc: ccFinal };
}
