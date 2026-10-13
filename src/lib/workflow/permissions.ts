import type { Actor, RequestRef, Stage, Status } from "./types";

/** The stage that currently holds a request, or null for terminal statuses. */
export function stageOf(status: Status): Stage | null {
  switch (status) {
    case "DRAFT":
    case "RETURNED":
      return "REQUESTER";
    case "PENDING_HOD":
      return "HOD";
    case "PENDING_LND":
      return "LND";
    case "PENDING_HR":
      return "HR";
    default:
      return null;
  }
}

/** Whether the actor holds the role that acts at `stage` for this request. */
export function holdsStage(req: RequestRef, actor: Actor, stage: Stage): boolean {
  switch (stage) {
    case "REQUESTER":
      return actor.id === req.requesterId;
    case "HOD":
      return req.departmentId !== null && actor.hodDepartmentIds.includes(req.departmentId);
    case "LND":
      return actor.roles.includes("LND");
    case "HR":
      return actor.roles.includes("HR_HEAD");
  }
}

export function canView(req: RequestRef, actor: Actor): boolean {
  if (actor.id === req.requesterId) return true;
  if (req.status === "DRAFT") return false; // drafts are private
  if (actor.roles.some((r) => r === "LND" || r === "HR_HEAD" || r === "SYS_ADMIN")) return true;
  if (req.departmentId && actor.hodDepartmentIds.includes(req.departmentId)) return true;
  if (req.businessUnitId && actor.buAdminBusinessUnitIds.includes(req.businessUnitId)) return true;
  return false;
}

export function canEditContent(req: RequestRef, actor: Actor): boolean {
  return actor.id === req.requesterId && (req.status === "DRAFT" || req.status === "RETURNED");
}

export function canEditLndFields(req: RequestRef, actor: Actor): boolean {
  return req.status === "PENDING_LND" && actor.roles.includes("LND");
}

export function canComment(req: RequestRef, actor: Actor): boolean {
  return req.status !== "DRAFT" && canView(req, actor);
}
