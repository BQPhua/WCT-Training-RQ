import type { Status } from "./types";

/** The approval stages a request can pass through, in order. HOD and L&D are always on. */
export type ApprovalStage = "HOD" | "BU" | "LND" | "HR";

/** A business unit's switches. A missing value means the step is on (the safe default). */
export interface RouteFlags {
  requiresBuAdmin?: boolean;
  requiresHrApproval?: boolean;
}

export const STAGE_STATUS: Record<ApprovalStage, Status> = {
  HOD: "PENDING_HOD",
  BU: "PENDING_BU",
  LND: "PENDING_LND",
  HR: "PENDING_HR",
};

/** The unit's approval route, e.g. Land/Malls: HOD → BU → L&D; E&C: HOD → BU → L&D → HR. */
export function routeOf(f: RouteFlags): ApprovalStage[] {
  return [
    "HOD",
    ...(f.requiresBuAdmin === false ? [] : (["BU"] as const)),
    "LND",
    ...(f.requiresHrApproval === false ? [] : (["HR"] as const)),
  ];
}

const ORDER: Status[] = ["PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR", "APPROVED"];

/**
 * Where a request goes after an approval at `from`: the next stage on the unit's route.
 * A request sitting at a stage that has since been switched off still moves forward from it
 * (in-flight requests are never stranded).
 */
export function nextStatusAfter(from: Status, f: RouteFlags): Status {
  const onRoute = new Set(routeOf(f).map((s) => STAGE_STATUS[s]));
  for (let i = ORDER.indexOf(from) + 1; i < ORDER.length; i++) {
    if (ORDER[i] === "APPROVED" || onRoute.has(ORDER[i])) return ORDER[i];
  }
  return "APPROVED";
}
