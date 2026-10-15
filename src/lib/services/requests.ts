import "server-only";
import { and, asc, desc, eq, max } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  attachments,
  businessUnits,
  candidates,
  comments,
  departments,
  requestActions,
  requestRevisions,
  trainingRequests,
  users,
  type TrainingRequest,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/load-user";
import { isDemoUser } from "@/lib/auth/roles";
import {
  canComment,
  canEditContent,
  canEditLndFields,
  canView,
  resolveRecipients,
  transition,
  WorkflowError,
  type Person,
  type RequestRef,
  type WorkflowEvent,
} from "@/lib/workflow";
import {
  commentSchema,
  draftSchema,
  lndFieldsSchema,
  requestFormSchema,
  type ActionSchemaInput,
  type DraftData,
  type DraftInput,
  type LndFieldsInput,
} from "@/lib/validation/request";
import { yearInMY } from "@/lib/format";
import { NoBuAdminError, NoDepartmentError, NoHodError, NotFoundError, ServiceError, StaleVersionError, ValidationFailedError } from "./errors";
import { loadParties, roleHolderCounts } from "./parties";
import { allocateRefNo } from "./ref-no";

export * from "./errors";
export { allocateRefNo } from "./ref-no";
export { visibleRequestsWhere, awaitingActionWhere, approvalsWhere } from "./queries";

// ---------- Notifications hook ----------
export interface NotifyArgs {
  event: WorkflowEvent;
  requestId: string;
  recipients: { to: Person[]; cc: Person[] };
  remark?: string | null;
}
export type Notifier = (args: NotifyArgs) => Promise<void>;

let notifier: Notifier = async (args) => (await import("@/lib/notify/send")).notifyEvent(args);
/** Wired to Power Automate in production (see lib/notify); stubbed in tests. */
export function setNotifier(n: Notifier) {
  notifier = n;
}
async function safeNotify(args: NotifyArgs) {
  try {
    await notifier(args);
  } catch (e) {
    console.error("[notify] failed", e instanceof Error ? e.message : e);
  }
}

// ---------- Helpers ----------
function ref(r: TrainingRequest): RequestRef {
  return { status: r.status, requesterId: r.requesterId, departmentId: r.departmentId, businessUnitId: r.businessUnitId };
}

async function lockRequest(tx: Tx, id: string): Promise<TrainingRequest> {
  const [r] = await tx.select().from(trainingRequests).where(eq(trainingRequests.id, id)).for("update");
  if (!r) throw new NotFoundError();
  return r;
}

async function assertVersion(tx: Tx, r: TrainingRequest, version: number) {
  if (r.version === version) return;
  const [last] = await tx
    .select({ name: users.name })
    .from(requestActions)
    .innerJoin(users, eq(requestActions.actorId, users.id))
    .where(eq(requestActions.requestId, r.id))
    .orderBy(desc(requestActions.createdAt))
    .limit(1);
  throw new StaleVersionError(last?.name ?? null);
}

/** Whether the request has a participant name list attached. */
async function hasNameList(tx: Tx, requestId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.requestId, requestId), eq(attachments.kind, "NAME_LIST")))
    .limit(1);
  return !!row;
}

function contentValues(d: DraftData, nameList: boolean) {
  return {
    trainingType: d.trainingType ?? null,
    title: d.title,
    objective: d.objective ?? null,
    relevancy: d.relevancy ?? null,
    participantCount: nameList ? (d.participantCount ?? null) : d.candidates.length || null,
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? d.startDate ?? null,
    startTime: d.startTime ?? null,
    endTime: d.endTime ?? null,
    feePerPax: d.feePerPax ?? null,
    venue: d.venue ?? null,
    conductedBy: d.conductedBy ?? null,
  };
}

async function replaceCandidates(tx: Tx, requestId: string, list: DraftData["candidates"]) {
  await tx.delete(candidates).where(eq(candidates.requestId, requestId));
  if (list.length) {
    await tx.insert(candidates).values(
      list.map((c, i) => ({
        requestId,
        sortOrder: i + 1,
        name: c.name,
        email: c.email ?? null,
        jobTitle: c.jobTitle ?? null,
        department: c.department ?? null,
        userId: c.userId ?? null,
      })),
    );
  }
}

async function loadContent(tx: Tx, r: TrainingRequest) {
  const cands = await tx
    .select()
    .from(candidates)
    .where(eq(candidates.requestId, r.id))
    .orderBy(asc(candidates.sortOrder));
  return {
    trainingType: r.trainingType ?? undefined,
    title: r.title,
    objective: r.objective ?? "",
    relevancy: r.relevancy ?? "",
    participantCount: r.participantCount,
    hasNameList: await hasNameList(tx, r.id),
    startDate: r.startDate ?? "",
    endDate: r.endDate ?? "",
    startTime: r.startTime ?? "",
    endTime: r.endTime ?? "",
    feePerPax: r.feePerPax ?? "",
    venue: r.venue ?? "",
    conductedBy: r.conductedBy ?? "",
    candidates: cands.map((c) => ({
      name: c.name,
      email: c.email ?? undefined,
      jobTitle: c.jobTitle ?? undefined,
      department: c.department ?? undefined,
      userId: c.userId ?? undefined,
    })),
  };
}

function parseDraft(data: unknown): DraftData {
  const parsed = draftSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "form"] ??= i.message;
    throw new ValidationFailedError(fieldErrors);
  }
  return parsed.data;
}

// ---------- Commands ----------
export async function createDraft(user: CurrentUser, data: DraftInput): Promise<{ id: string }> {
  const d = parseDraft(data);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(trainingRequests)
      .values({
        ...contentValues(d, false),
        requesterId: user.id,
        departmentId: user.departmentId,
        businessUnitId: user.businessUnit?.id ?? null,
      })
      .returning({ id: trainingRequests.id });
    await replaceCandidates(tx, row.id, d.candidates);
    await tx.insert(requestActions).values({ requestId: row.id, actorId: user.id, action: "CREATE", toStatus: "DRAFT" });
    return row;
  });
}

export async function updateContent(user: CurrentUser, id: string, version: number, data: DraftInput): Promise<{ version: number }> {
  const d = parseDraft(data);
  return db.transaction(async (tx) => {
    const r = await lockRequest(tx, id);
    if (!canView(ref(r), user.actor)) throw new NotFoundError();
    await assertDemoScope(tx, user, r.requesterId);
    if (!canEditContent(ref(r), user.actor)) throw new WorkflowError("FORBIDDEN", "This request can no longer be edited.");
    await assertVersion(tx, r, version);
    const [u] = await tx
      .update(trainingRequests)
      .set({
        ...contentValues(d, await hasNameList(tx, id)),
        departmentId: user.departmentId,
        businessUnitId: user.businessUnit?.id ?? null,
        version: r.version + 1,
      })
      .where(eq(trainingRequests.id, id))
      .returning({ version: trainingRequests.version });
    await replaceCandidates(tx, id, d.candidates);
    return u;
  });
}

/**
 * Demo accounts (signed in from the demo list, or "viewed as" by an admin) may only
 * act on demo requests, so demo role holders can never decide on real staff requests.
 */
async function assertDemoScope(tx: Tx, user: CurrentUser, requesterId: string) {
  if (!isDemoUser(user)) return;
  const [r] = await tx.select({ email: users.email }).from(users).where(eq(users.id, requesterId));
  if (!r || !isDemoUser(r)) {
    throw new ServiceError(
      user.viewedBy ? "While viewing as a demo user you can only act on demo requests." : "Demo accounts can only act on demo requests.",
      403,
    );
  }
}

/** A request can only move towards the BU Admin step when its business unit has one. */
async function assertBuAdmin(tx: Tx, businessUnitId: string | null, forRequester: boolean) {
  const { buAdmin } = await roleHolderCounts(tx, businessUnitId);
  if (buAdmin > 0) return;
  const [bu] = businessUnitId
    ? await tx.select({ name: businessUnits.name }).from(businessUnits).where(eq(businessUnits.id, businessUnitId))
    : [];
  throw new NoBuAdminError(bu?.name ?? null, forRequester);
}

export async function performAction(
  user: CurrentUser,
  input: Pick<ActionSchemaInput, "requestId" | "version" | "type" | "remark">,
): Promise<{ status: TrainingRequest["status"]; refNo: string | null; version: number }> {
  let notifyArgs: NotifyArgs | null = null;

  const result = await db.transaction(async (tx) => {
    const r = await lockRequest(tx, input.requestId);
    if (!canView(ref(r), user.actor)) throw new NotFoundError();
    await assertDemoScope(tx, user, r.requesterId);
    await assertVersion(tx, r, input.version);

    const isSubmit = input.type === "SUBMIT" || input.type === "RESUBMIT";
    let departmentId = r.departmentId;
    let businessUnitId = r.businessUnitId;

    if (isSubmit) {
      if (!user.departmentId || !user.department) throw new NoDepartmentError();
      if (!user.department.isActive) throw new ServiceError("Your department is no longer active. Please contact HR.", 422);
      const hodId = user.department.hodUserId;
      const [hod] = hodId ? await tx.select({ isActive: users.isActive }).from(users).where(eq(users.id, hodId)) : [];
      if (!hod?.isActive) throw new NoHodError();
      const content = await loadContent(tx, r);
      const parsed = requestFormSchema.safeParse(content);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "form"] ??= i.message;
        throw new ValidationFailedError(fieldErrors);
      }
      departmentId = user.departmentId;
      businessUnitId = user.department.businessUnitId;
    }

    const counts = await roleHolderCounts(tx, businessUnitId);
    // transition() first, so someone without rights gets FORBIDDEN rather than the BU Admin message.
    const t = transition({ ...ref(r), departmentId, businessUnitId }, user.actor, { type: input.type, remark: input.remark }, counts);
    if (t.toStatus === "PENDING_BU" || (isSubmit && t.toStatus === "PENDING_HOD")) await assertBuAdmin(tx, businessUnitId, isSubmit);
    const now = new Date();

    let refNo = r.refNo;
    if (isSubmit && !refNo) refNo = await allocateRefNo(tx, yearInMY(now));

    const [updated] = await tx
      .update(trainingRequests)
      .set({
        status: t.toStatus,
        version: r.version + 1,
        refNo,
        departmentId,
        businessUnitId,
        submittedAt: isSubmit ? now : r.submittedAt,
        finalisedAt: t.toStatus === "APPROVED" || t.toStatus === "CANCELLED" ? now : null,
      })
      .where(eq(trainingRequests.id, r.id))
      .returning();

    if (isSubmit) {
      const [{ n }] = await tx
        .select({ n: max(requestRevisions.revisionNo) })
        .from(requestRevisions)
        .where(eq(requestRevisions.requestId, r.id));
      await tx.insert(requestRevisions).values({
        requestId: r.id,
        revisionNo: (n ?? 0) + 1,
        snapshot: await loadContent(tx, updated),
        createdById: user.id,
      });
    }

    const parties = await loadParties(tx, updated);
    const recipients = resolveRecipients(t.event, parties);
    const remark = input.remark?.trim() || null;

    await tx.insert(requestActions).values({
      requestId: r.id,
      actorId: user.id,
      action: input.type,
      fromStatus: r.status,
      toStatus: t.toStatus,
      sentBackTo: t.event.sentBackTo ?? null,
      remark,
      selfApproved: t.selfApproved,
      notified: [...recipients.to, ...recipients.cc].map((p) => ({ name: p.name, email: p.email })),
    });

    notifyArgs = { event: t.event, requestId: r.id, recipients, remark };
    return { status: updated.status, refNo: updated.refNo, version: updated.version };
  });

  if (notifyArgs) await safeNotify(notifyArgs);
  return result;
}

export async function updateLndFields(user: CurrentUser, id: string, version: number, data: LndFieldsInput) {
  const d = lndFieldsSchema.parse(data);
  return db.transaction(async (tx) => {
    const r = await lockRequest(tx, id);
    if (!canView(ref(r), user.actor)) throw new NotFoundError();
    await assertDemoScope(tx, user, r.requesterId);
    if (!canEditLndFields(ref(r), user.actor)) {
      throw new WorkflowError("FORBIDDEN", "L&D details can only be edited while the request is pending L&D review.");
    }
    await assertVersion(tx, r, version);
    const [u] = await tx
      .update(trainingRequests)
      .set({
        hrdcClaimable: d.hrdcClaimable ?? null,
        hrdcGrantNo: d.hrdcGrantNo || null,
        lndRemarks: d.lndRemarks || null,
        version: r.version + 1,
      })
      .where(eq(trainingRequests.id, id))
      .returning({ version: trainingRequests.version });
    await tx.insert(requestActions).values({
      requestId: id,
      actorId: user.id,
      action: "EDIT_LND_FIELDS",
      fromStatus: r.status,
      toStatus: r.status,
    });
    return u;
  });
}

export async function addComment(user: CurrentUser, id: string, body: string) {
  const { body: text } = commentSchema.parse({ body });
  let args: NotifyArgs | null = null;
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(trainingRequests).where(eq(trainingRequests.id, id));
    if (!r || !canView(ref(r), user.actor)) throw new NotFoundError();
    await assertDemoScope(tx, user, r.requesterId);
    if (!canComment(ref(r), user.actor)) throw new WorkflowError("FORBIDDEN", "Comments open once the request is submitted.");
    await tx.insert(comments).values({ requestId: id, authorId: user.id, body: text });
    const event: WorkflowEvent = { kind: "COMMENTED", fromStatus: r.status, actorId: user.id };
    args = { event, requestId: id, recipients: resolveRecipients(event, await loadParties(tx, r)), remark: text };
  });
  if (args) await safeNotify(args);
}

export async function cloneRequest(user: CurrentUser, id: string): Promise<{ id: string }> {
  const detail = await getRequestForUser(user, id);
  if (!detail) throw new NotFoundError();
  const content = await loadContent(db, detail.request);
  return createDraft(user, {
    ...content,
    trainingType: content.trainingType,
    title: content.title,
    objective: content.objective || undefined,
    relevancy: content.relevancy || undefined,
    participantCount: undefined, // the name list is not copied; the count follows the typed names
    startDate: content.startDate || undefined,
    endDate: content.endDate || undefined,
    startTime: content.startTime || undefined,
    endTime: content.endTime || undefined,
    feePerPax: content.feePerPax || undefined,
    venue: content.venue || undefined,
    conductedBy: content.conductedBy || undefined,
  });
}

// ---------- Queries ----------
export async function getRequestForUser(user: CurrentUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await db.query.trainingRequests.findFirst({
    where: eq(trainingRequests.id, id),
    with: {
      requester: true,
      department: { with: { hod: true } },
      businessUnit: true,
      candidates: { orderBy: asc(candidates.sortOrder) },
      actions: { orderBy: asc(requestActions.createdAt), with: { actor: true } },
      comments: { orderBy: asc(comments.createdAt), with: { author: true } },
      attachments: { orderBy: asc(attachments.createdAt) },
      revisions: { orderBy: desc(requestRevisions.revisionNo) },
    },
  });
  if (!row || !canView(ref(row), user.actor)) return null;
  if (isDemoUser(user) && !isDemoUser(row.requester)) return null; // demo accounts see demo requests only
  const { candidates: cands, actions, comments: cmts, attachments: atts, revisions, requester, department, businessUnit, ...request } = row;
  return {
    request: request as TrainingRequest,
    requester,
    department,
    businessUnit,
    candidates: cands,
    actions,
    comments: cmts,
    attachments: atts,
    revisions,
    counts: await roleHolderCounts(db, (request as TrainingRequest).businessUnitId),
  };
}
export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestForUser>>>;

/** For filters & pickers. */
export async function listDepartmentsWithBu() {
  return db
    .select({ id: departments.id, name: departments.name, buId: businessUnits.id, buName: businessUnits.name, buCode: businessUnits.code, hodUserId: departments.hodUserId })
    .from(departments)
    .innerJoin(businessUnits, eq(departments.businessUnitId, businessUnits.id))
    .where(and(eq(departments.isActive, true), eq(businessUnits.isActive, true)))
    .orderBy(asc(businessUnits.name), asc(departments.name));
}
