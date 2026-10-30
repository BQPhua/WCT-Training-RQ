export const STATUSES = [
  "DRAFT",
  "PENDING_HOD",
  "PENDING_BU",
  "PENDING_LND",
  "PENDING_HR",
  "RETURNED",
  "APPROVED",
  "CANCELLED",
] as const;
export type Status = (typeof STATUSES)[number];

/** Who holds a request at a given point. */
export type Stage = "REQUESTER" | "HOD" | "BU" | "LND" | "HR";
export type RoleName = "LND" | "HR_HEAD" | "SYS_ADMIN";
export type WorkflowActionType = "SUBMIT" | "RESUBMIT" | "APPROVE" | "REJECT" | "CANCEL";

export interface Actor {
  id: string;
  roles: RoleName[];
  /** Departments this user is currently HOD of. */
  hodDepartmentIds: string[];
  /** Business units this user is currently BU Admin of. */
  buAdminBusinessUnitIds: string[];
}

export interface RequestRef {
  status: Status;
  requesterId: string;
  departmentId: string | null;
  businessUnitId: string | null;
  /**
   * Does the request's business unit need HR Head's final approval?
   * Only consulted when L&D approves. Missing means true (E&C, or no unit).
   */
  requiresHrApproval?: boolean;
  /** Does the unit's route include the BU Admin step? Missing means true. */
  requiresBuAdmin?: boolean;
}

/** Number of active holders of each pooled role (for the self-approval rule). */
export interface RoleHolderCounts {
  lnd: number;
  hrHead: number;
  /** Active BU Admins of the request's business unit. */
  buAdmin: number;
}

export interface AllowedAction {
  type: WorkflowActionType;
}

export interface ActionInput {
  type: WorkflowActionType;
  remark?: string;
}

export type WorkflowEventKind =
  | "SUBMITTED"
  | "RESUBMITTED"
  | "HOD_APPROVED"
  | "BU_APPROVED"
  | "LND_APPROVED"
  | "FINAL_APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMMENTED";

export interface WorkflowEvent {
  kind: WorkflowEventKind;
  /** Status the request was in when the event happened. */
  fromStatus: Status;
  /** Status the request moved to (set on approvals, so recipients know who is next). */
  toStatus?: Status;
  actorId: string;
  /** For REJECTED: the stage that rejected. */
  byStage?: Stage;
  /** For REJECTED: always the requester (approval restarts at the HOD). */
  sentBackTo?: Stage;
}

export interface TransitionResult {
  toStatus: Status;
  selfApproved: boolean;
  event: WorkflowEvent;
}

export interface Person {
  id: string;
  name: string;
  email: string;
}

/** The people attached to a request, resolved from current mappings. */
export interface Parties {
  requester: Person;
  hod: Person | null;
  lnd: Person[];
  hrHeads: Person[];
  buAdmins: Person[];
  /** Everyone who approved since the latest submit/resubmit (copied on a rejection). */
  roundApprovers: Person[];
}

export type WorkflowErrorCode = "FORBIDDEN" | "INVALID_STATE" | "REMARK_REQUIRED";

const MESSAGES: Record<WorkflowErrorCode, string> = {
  FORBIDDEN: "You are not allowed to perform this action on this request.",
  INVALID_STATE: "This action is not available at the request's current status.",
  REMARK_REQUIRED: "Please provide a remark (at least 3 characters).",
};

export class WorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = "WorkflowError";
  }
}

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  PENDING_HOD: "Pending HOD",
  PENDING_BU: "Pending BU Admin",
  PENDING_LND: "Pending L&D",
  PENDING_HR: "Pending HR Head",
  RETURNED: "Returned",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export const STAGE_LABEL: Record<Stage, string> = {
  REQUESTER: "Requester",
  HOD: "Department HOD",
  BU: "BU Admin",
  LND: "L&D Team",
  HR: "HR Head",
};

export const EVENT_LABEL: Record<WorkflowEventKind, string> = {
  SUBMITTED: "Submitted for approval",
  RESUBMITTED: "Resubmitted for approval",
  HOD_APPROVED: "Approved by HOD",
  BU_APPROVED: "Approved by BU Admin",
  LND_APPROVED: "Approved by L&D",
  FINAL_APPROVED: "Final approval",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMMENTED: "New comment",
};
