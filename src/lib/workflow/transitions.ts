import { holdsStage, stageOf } from "./permissions";
import {
  WorkflowError,
  type ActionInput,
  type Actor,
  type AllowedAction,
  type NotifyTarget,
  type RequestRef,
  type RoleHolderCounts,
  type Stage,
  type Status,
  type TransitionResult,
  type WorkflowEventKind,
} from "./types";

const PENDING: Status[] = ["PENDING_HOD", "PENDING_LND", "PENDING_HR"];
const CANCELLABLE: Status[] = ["DRAFT", ...PENDING, "RETURNED"];

const SEND_BACK: Partial<Record<Status, Stage[]>> = {
  PENDING_HOD: ["REQUESTER"],
  PENDING_LND: ["REQUESTER", "HOD"],
  PENDING_HR: ["REQUESTER", "HOD", "LND"],
};

const STATUS_FOR_STAGE: Record<Stage, Status> = {
  REQUESTER: "RETURNED",
  HOD: "PENDING_HOD",
  LND: "PENDING_LND",
  HR: "PENDING_HR",
};

const APPROVE_NEXT: Partial<Record<Status, { to: Status; kind: WorkflowEventKind }>> = {
  PENDING_HOD: { to: "PENDING_LND", kind: "HOD_APPROVED" },
  PENDING_LND: { to: "PENDING_HR", kind: "LND_APPROVED" },
  PENDING_HR: { to: "APPROVED", kind: "FINAL_APPROVED" },
};

/** Earlier stages a rejector at `status` may send the request back to. */
export function sendBackOptions(status: Status): Stage[] {
  return SEND_BACK[status] ?? [];
}

/**
 * Can `actor` act as approver at the current stage?
 * Returns { ok, selfApproved }. Applies the self-approval rule:
 * HOD may approve own request; pooled roles (L&D, HR Head) only when the
 * actor is the sole active holder of that role.
 */
function approverCheck(req: RequestRef, actor: Actor, counts: RoleHolderCounts) {
  const stage = stageOf(req.status);
  if (!stage || stage === "REQUESTER" || !holdsStage(req, actor, stage)) return { ok: false, selfApproved: false };
  const isOwn = actor.id === req.requesterId;
  if (!isOwn) return { ok: true, selfApproved: false };
  if (stage === "HOD") return { ok: true, selfApproved: true };
  const holders = stage === "LND" ? counts.lnd : counts.hrHead;
  return holders <= 1 ? { ok: true, selfApproved: true } : { ok: false, selfApproved: false };
}

export function getAllowedActions(req: RequestRef, actor: Actor, counts: RoleHolderCounts): AllowedAction[] {
  const actions: AllowedAction[] = [];
  const isRequester = actor.id === req.requesterId;

  if (isRequester && req.status === "DRAFT") actions.push({ type: "SUBMIT" });
  if (isRequester && req.status === "RETURNED") actions.push({ type: "RESUBMIT" });

  if (PENDING.includes(req.status) && approverCheck(req, actor, counts).ok) {
    actions.push({ type: "APPROVE" });
    actions.push({ type: "REJECT", sendBackOptions: sendBackOptions(req.status) });
  }

  if (isRequester && CANCELLABLE.includes(req.status)) actions.push({ type: "CANCEL" });
  return actions;
}

function requireRemark(remark: string | undefined): string {
  const r = remark?.trim() ?? "";
  if (r.length < 3) throw new WorkflowError("REMARK_REQUIRED");
  return r;
}

const NOTIFY_TARGETS: NotifyTarget[] = ["REQUESTER", "HOD", "LND"];

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
      const next = APPROVE_NEXT[from];
      if (!next) throw new WorkflowError("INVALID_STATE");
      const check = approverCheck(req, actor, counts);
      if (!check.ok) throw new WorkflowError("FORBIDDEN");
      return { toStatus: next.to, selfApproved: check.selfApproved, event: { ...base, kind: next.kind } };
    }

    case "REJECT": {
      if (!PENDING.includes(from)) throw new WorkflowError("INVALID_STATE");
      const check = approverCheck(req, actor, counts);
      if (!check.ok) throw new WorkflowError("FORBIDDEN");
      requireRemark(input.remark);
      const target = input.sendBackTo ?? "REQUESTER";
      if (!sendBackOptions(from).includes(target)) throw new WorkflowError("INVALID_SEND_BACK");
      const notify = [...new Set((input.notify ?? []).filter((n) => NOTIFY_TARGETS.includes(n)))];
      return {
        toStatus: STATUS_FOR_STAGE[target],
        selfApproved: false,
        event: { ...base, kind: "REJECTED", byStage: stageOf(from)!, sentBackTo: target, notify },
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
