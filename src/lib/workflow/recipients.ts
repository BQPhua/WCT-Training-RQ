import { stageOf } from "./permissions";
import type { Parties, Person, Stage, WorkflowEvent } from "./types";

function ownersOf(stage: Stage | null, p: Parties): Person[] {
  switch (stage) {
    case "REQUESTER":
      return [p.requester];
    case "HOD":
      return p.hod ? [p.hod] : [];
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
 * Who should be emailed for a workflow event (spec §3.3).
 * The actor is removed from `to`; anyone in `to` is removed from `cc`.
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
      to = [...p.lnd, ...p.buAdmins];
      cc = [p.requester];
      break;
    case "LND_APPROVED":
      to = p.hrHeads;
      cc = [p.requester];
      break;
    case "FINAL_APPROVED":
      to = [p.requester];
      cc = [...ownersOf("HOD", p), ...p.lnd, ...p.buAdmins];
      break;
    case "REJECTED": {
      const selected = (event.notify ?? []).flatMap((t) => ownersOf(t, p));
      to = [...ownersOf(event.sentBackTo ?? "REQUESTER", p), ...selected, ...p.buAdmins];
      break;
    }
    case "CANCELLED":
      if (event.fromStatus === "DRAFT") break;
      to = [...ownersOf(stageOf(event.fromStatus) === "REQUESTER" ? null : stageOf(event.fromStatus), p), ...p.buAdmins];
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
  const ccFinal = dedupe(cc, new Set(toFinal.map((x) => x.email.toLowerCase())));
  return { to: toFinal, cc: ccFinal };
}
