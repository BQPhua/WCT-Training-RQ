import "server-only";
import type { CurrentUser } from "@/lib/auth/load-user";
import type { RequestDetail } from "./requests";
import { listDepartmentsWithBu } from "./requests";
import { db } from "@/db";
import { businessUnitAdmins, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Data the request form needs about the signed-in requester. */
export async function requesterContext(user: CurrentUser) {
  let hodName: string | null = null;
  if (user.department?.hodUserId) {
    const [h] = await db.select({ name: users.name, isActive: users.isActive }).from(users).where(eq(users.id, user.department.hodUserId));
    hodName = h?.isActive ? h.name : null;
  }
  const buAdmins = user.businessUnit
    ? await db
        .select({ name: users.name })
        .from(businessUnitAdmins)
        .innerJoin(users, eq(businessUnitAdmins.userId, users.id))
        .where(and(eq(businessUnitAdmins.businessUnitId, user.businessUnit.id), eq(users.isActive, true)))
    : [];
  const depts = await listDepartmentsWithBu();
  return {
    requester: {
      name: user.name,
      department: user.department?.name ?? null,
      businessUnit: user.businessUnit?.name ?? null,
      hodName,
      buAdminNames: buAdmins.length ? buAdmins.map((b) => b.name).join(", ") : null,
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
