import { holdsStage, stageOf } from "./permissions";
import { nextStatusAfter } from "./route";
import {
  WorkflowError,
  type ActionInput,
  type Actor,
  type AllowedAction,
  type RequestRef,
  type RoleHolderCounts,
  type Status,
  type TransitionResult,
  type WorkflowEventKind,
} from "./types";

const PENDING: Status[] = ["PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR"];
const CANCELLABLE: Status[] = ["DRAFT", ...PENDING, "RETURNED"];

/** The event raised by an approval at each stage; the final approval is always FINAL_APPROVED. */
const APPROVE_KIND: Partial<Record<Status, WorkflowEventKind>> = {
  PENDING_HOD: "HOD_APPROVED",
  PENDING_BU: "BU_APPROVED",
  PENDING_LND: "LND_APPROVED",
  PENDING_HR: "FINAL_APPROVED",
};

/**
 * Can `actor` act as approver at the current stage?
 * Returns { ok, selfApproved }. Applies the self-approval rule:
 * HOD may approve own request; pooled roles (BU Admin of the unit, L&D,
 * HR Head) only when the actor is the sole active holder of that role.
 */
function approverCheck(req: RequestRef, actor: Actor, counts: RoleHolderCounts) {
  const stage = stageOf(req.status);
  if (!stage || stage === "REQUESTER" || !holdsStage(req, actor, stage)) return { ok: false, selfApproved: false };
  const isOwn = actor.id === req.requesterId;
  if (!isOwn) return { ok: true, selfApproved: false };
  if (stage === "HOD") return { ok: true, selfApproved: true };
  const holders = stage === "BU" ? counts.buAdmin : stage === "LND" ? counts.lnd : counts.hrHead;
  return holders <= 1 ? { ok: true, selfApproved: true } : { ok: false, selfApproved: false };
}

export function getAllowedActions(req: RequestRef, actor: Actor, counts: RoleHolderCounts): AllowedAction[] {
  const actions: AllowedAction[] = [];
  const isRequester = actor.id === req.requesterId;

  if (isRequester && req.status === "DRAFT") actions.push({ type: "SUBMIT" });
  if (isRequester && req.status === "RETURNED") actions.push({ type: "RESUBMIT" });

  if (PENDING.includes(req.status) && approverCheck(req, actor, counts).ok) {
    actions.push({ type: "APPROVE" });
    actions.push({ type: "REJECT" });
  }

  if (isRequester && CANCELLABLE.includes(req.status)) actions.push({ type: "CANCEL" });
  return actions;
}

function requireRemark(remark: string | undefined): string {
  const r = remark?.trim() ?? "";
  if (r.length < 3) throw new WorkflowError("REMARK_REQUIRED");
  return r;
}

export function transition(
  req: RequestRef,
  actor: Actor,
  input: ActionInput,
  counts: RoleHolderCounts,
): TransitionResult {
  const from = req.status;
  const base = { fromStatus: from, actorId: actor.id };
  const isRequester = actor.id === req.requesterId;

  switch (input.type) {
    case "SUBMIT":
    case "RESUBMIT": {
      const expected: Status = input.type === "SUBMIT" ? "DRAFT" : "RETURNED";
      if (from !== expected) throw new WorkflowError("INVALID_STATE");
      if (!isRequester) throw new WorkflowError("FORBIDDEN");
      return {
        toStatus: "PENDING_HOD",
        selfApproved: false,
        event: { ...base, kind: input.type === "SUBMIT" ? "SUBMITTED" : "RESUBMITTED" },
      };
    }

    case "APPROVE": {
      const kind = APPROVE_KIND[from];
      if (!kind) throw new WorkflowError("INVALID_STATE");
      const check = approverCheck(req, actor, counts);
      if (!check.ok) throw new WorkflowError("FORBIDDEN");
      const to = nextStatusAfter(from, req);
      return { toStatus: to, selfApproved: check.selfApproved, event: { ...base, kind: to === "APPROVED" ? "FINAL_APPROVED" : kind, toStatus: to } };
    }

    case "REJECT": {
      if (!PENDING.includes(from)) throw new WorkflowError("INVALID_STATE");
      const check = approverCheck(req, actor, counts);
      if (!check.ok) throw new WorkflowError("FORBIDDEN");
      requireRemark(input.remark);
      return {
        toStatus: "RETURNED",
        selfApproved: false,
        event: { ...base, kind: "REJECTED", byStage: stageOf(from)!, sentBackTo: "REQUESTER" },
      };
    }

    case "CANCEL": {
      if (!CANCELLABLE.includes(from)) throw new WorkflowError("INVALID_STATE");
      if (!isRequester) throw new WorkflowError("FORBIDDEN");
      requireRemark(input.remark);
      return { toStatus: "CANCELLED", selfApproved: false, event: { ...base, kind: "CANCELLED" } };
    }
  }
}
