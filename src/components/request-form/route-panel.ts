import type { ApprovalStage } from "@/lib/workflow/route";

export interface RouteRow {
  stage: string;
  who: string;
  /** Nobody holds this step yet: the request can't be submitted until HR fixes it. */
  missing?: boolean;
}

/** The "Approval route" panel on the request form, built from the requester's unit route. */
export function routePanelRows(r: {
  name: string;
  hodName: string | null;
  businessUnit: string | null;
  buAdminNames: string | null;
  route: ApprovalStage[];
}): RouteRow[] {
  const last = r.route.at(-1);
  const rows: RouteRow[] = [{ stage: "You submit", who: r.name }];
  for (const s of r.route) {
    if (s === "HOD") rows.push({ stage: "Department HOD", who: r.hodName ?? "Not assigned — contact HR", missing: !r.hodName });
    if (s === "BU")
      rows.push({
        stage: r.businessUnit ? `${r.businessUnit} BU Admin` : "BU Admin",
        who: r.buAdminNames ?? "Not assigned — contact HR",
        missing: !r.buAdminNames,
      });
    if (s === "LND") rows.push({ stage: "L&D Team", who: last === "LND" ? "Reviews and gives final approval" : "Any L&D member reviews" });
    if (s === "HR") rows.push({ stage: "HR Head", who: "Final approval" });
  }
  return rows;
}
