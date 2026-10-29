import "server-only";
import type { CurrentUser } from "@/lib/auth/load-user";
import type { RequestDetail } from "./requests";
import { listDepartmentsWithBu } from "./requests";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buAdminNames, worldOf } from "./parties";

/** Data the request form needs about the signed-in requester. */
export async function requesterContext(user: CurrentUser) {
  let hodName: string | null = null;
  if (user.department?.hodUserId) {
    const [h] = await db.select({ name: users.name, email: users.email, isActive: users.isActive }).from(users).where(eq(users.id, user.department.hodUserId));
    // Demo and real staff never mix: a demo HOD isn't shown to real staff, and vice versa.
    hodName = h?.isActive && worldOf(h.email) === worldOf(user.email) ? h.name : null;
  }
  const names = await buAdminNames(db, user.businessUnit?.id ?? null, worldOf(user.email));
  const depts = await listDepartmentsWithBu();
  return {
    requester: {
      name: user.name,
      department: user.department?.name ?? null,
      businessUnit: user.businessUnit?.name ?? null,
      hodName,
      buAdminNames: names,
      /** Land and Malls end at L&D; E&C (or no unit) goes on to HR Head. */
      requiresHrApproval: user.businessUnit?.requiresHrApproval ?? true,
    },
    departments: depts.map((d) => ({ id: d.id, name: d.name, buName: d.buName })),
  };
}

export function formValuesFrom(detail: RequestDetail) {
  const r = detail.request;
  return {
    initial: {
      trainingType: (r.trainingType ?? "") as "" | "PLANNED" | "ADHOC",
      title: r.title,
      objective: r.objective ?? "",
      relevancy: r.relevancy ?? "",
      startDate: r.startDate ?? "",
      endDate: r.endDate ?? "",
      startTime: r.startTime ?? "",
      endTime: r.endTime ?? "",
      feePerPax: r.feePerPax ?? "",
      venue: r.venue ?? "",
      conductedBy: r.conductedBy ?? "",
    },
    initialCandidates: detail.candidates.map((c) => c.name),
    initialParticipantCount: r.participantCount,
    initialNameList: (() => {
      const a = detail.attachments.find((x) => x.kind === "NAME_LIST");
      return a ? { id: a.id, originalName: a.originalName, sizeBytes: a.sizeBytes } : null;
    })(),
    initialAttachments: detail.attachments
      .filter((a) => a.kind !== "NAME_LIST")
      .map((a) => ({ id: a.id, originalName: a.originalName, sizeBytes: a.sizeBytes })),
  };
}
