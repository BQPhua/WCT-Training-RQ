import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessUnitAdmins, businessUnits, departments, requestActions, requestRevisions, trainingRequests, users } from "@/db/schema";
import { seed } from "@/db/seed";
import {
  NoBuAdminError,
  NoDepartmentError,
  NotFoundError,
  NoHodError,
  StaleVersionError,
  ValidationFailedError,
  allocateRefNo,
  awaitingActionWhere,
  cloneRequest,
  createDraft,
  getRequestForUser,
  performAction,
  setNotifier,
  updateContent,
  updateLndFields,
  addComment,
} from "@/lib/services/requests";
import { WorkflowError } from "@/lib/workflow";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

const year = new Date().getFullYear();
const notifier = vi.fn(async () => {});

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  notifier.mockClear();
  setNotifier(notifier);
});

async function versionOf(id: string) {
  const [r] = await db.select({ v: trainingRequests.version }).from(trainingRequests).where(eq(trainingRequests.id, id));
  return r.v;
}

async function act(email: string, id: string, input: Record<string, unknown>) {
  const user = await asUser(email);
  return performAction(user, { requestId: id, version: await versionOf(id), ...input } as never);
}

async function submitted(email = "requester@demo.wct.my") {
  const req = await asUser(email);
  const { id } = await createDraft(req, validDraft);
  await act(email, id, { type: "SUBMIT" });
  return id;
}

async function statusOf(id: string) {
  const [r] = await db.select({ s: trainingRequests.status, f: trainingRequests.finalisedAt }).from(trainingRequests).where(eq(trainingRequests.id, id));
  return r;
}

async function setHrFlag(code: string, value: boolean) {
  await db.update(businessUnits).set({ requiresHrApproval: value }).where(eq(businessUnits.code, code));
}

describe("route per business unit", () => {
  it("Malls request is approved by L&D without HR Head", async () => {
    const id = await submitted("requester.malls@demo.wct.my");
    await act("hod.malls@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.malls@demo.wct.my", id, { type: "APPROVE" });
    notifier.mockClear();
    const res = await act("lnd1@demo.wct.my", id, { type: "APPROVE", remark: "Final" });
    expect(res.status).toBe("APPROVED");
    expect((await statusOf(id)).f).not.toBeNull();
    const [last] = (await db.select().from(requestActions).where(eq(requestActions.requestId, id))).slice(-1);
    expect(last.fromStatus).toBe("PENDING_LND");
    expect(last.toStatus).toBe("APPROVED");
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("Land request is approved by L&D without HR Head", async () => {
    const id = await submitted("requester@demo.wct.my");
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.land@demo.wct.my", id, { type: "APPROVE" });
    expect((await act("lnd1@demo.wct.my", id, { type: "APPROVE" })).status).toBe("APPROVED");
  });

  it("E&C request still goes to HR Head", async () => {
    const id = await submitted("requester.enc@demo.wct.my");
    await act("hod.enc@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.enc@demo.wct.my", id, { type: "APPROVE" });
    expect((await act("lnd1@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_HR");
    expect((await act("hrhead@demo.wct.my", id, { type: "APPROVE" })).status).toBe("APPROVED");
  });

  it("Request with no business unit goes to HR Head", async () => {
    const id = await submitted("requester.malls@demo.wct.my");
    await act("hod.malls@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.malls@demo.wct.my", id, { type: "APPROVE" });
    await db.update(trainingRequests).set({ businessUnitId: null }).where(eq(trainingRequests.id, id));
    expect((await act("lnd1@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_HR");
  });

  it("Flag read at L&D approval time", async () => {
    const id = await submitted("requester.malls@demo.wct.my");
    await act("hod.malls@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.malls@demo.wct.my", id, { type: "APPROVE" });
    await setHrFlag("MALLS", true);
    expect((await act("lnd1@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_HR");
  });

  it("In-flight PENDING_HR Malls request can be approved by HR Head", async () => {
    await setHrFlag("MALLS", true);
    const id = await submitted("requester.malls@demo.wct.my");
    await act("hod.malls@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.malls@demo.wct.my", id, { type: "APPROVE" });
    expect((await act("lnd1@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_HR");
    await setHrFlag("MALLS", false);
    expect((await act("hrhead@demo.wct.my", id, { type: "APPROVE" })).status).toBe("APPROVED");
  });
});

describe("happy path", () => {
  it("goes DRAFT → HOD → BU Admin → L&D → HR → APPROVED with ref no and audit trail (E&C)", async () => {
    const id = await submitted("requester.enc@demo.wct.my");
    expect((await act("hod.enc@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_BU");
    expect((await act("buadmin.enc@demo.wct.my", id, { type: "APPROVE" })).status).toBe("PENDING_LND");
    await act("lnd1@demo.wct.my", id, { type: "APPROVE", remark: "HRDC claimable" });
    const res = await act("hrhead@demo.wct.my", id, { type: "APPROVE" });

    expect(res.status).toBe("APPROVED");
    expect(res.refNo).toBe(`TRQ-${year}-0001`);
    const actions = await db.select().from(requestActions).where(eq(requestActions.requestId, id));
    expect(actions.map((a) => a.action)).toEqual(["CREATE", "SUBMIT", "APPROVE", "APPROVE", "APPROVE", "APPROVE"]);
    const [row] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, id));
    expect(row.finalisedAt).not.toBeNull();
    expect(notifier).toHaveBeenCalledTimes(5);
  });

  it("allocates sequential ref numbers", async () => {
    await submitted();
    const id2 = await submitted();
    const [r] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, id2));
    expect(r.refNo).toBe(`TRQ-${year}-0002`);
  });

  it("records notified recipients on the action, BU Admin on HOD approval", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    const actions = await db.select().from(requestActions).where(eq(requestActions.requestId, id));
    const approve = actions.find((a) => a.action === "APPROVE")!;
    expect(approve.notified?.map((n) => n.email)).toContain("buadmin.land@demo.wct.my");
  });
});

describe("BU Admin step and rejection", () => {
  const ccOf = (call: number) => (notifier.mock.calls[call] as unknown as [{ recipients: { to: { email: string }[]; cc: { email: string }[] } }])[0].recipients;

  it("submit is blocked when the business unit has no BU Admin", async () => {
    await db.delete(businessUnitAdmins);
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(act("requester@demo.wct.my", id, { type: "SUBMIT" })).rejects.toBeInstanceOf(NoBuAdminError);
    await expect(act("requester@demo.wct.my", id, { type: "SUBMIT" })).rejects.toThrow(
      "Your business unit (Land) has no BU Admin assigned. Please contact HR.",
    );
  });

  it("HOD approval is blocked after the unit's only BU Admin is deactivated, with a message for the approver", async () => {
    const id = await submitted();
    await db.update(users).set({ isActive: false }).where(eq(users.email, "buadmin.land@demo.wct.my"));
    await expect(act("hod.land@demo.wct.my", id, { type: "APPROVE" })).rejects.toBeInstanceOf(NoBuAdminError);
    await expect(act("hod.land@demo.wct.my", id, { type: "APPROVE" })).rejects.toThrow(
      "This request's business unit (Land) has no BU Admin assigned, so it can't move on yet. Please contact HR.",
    );
  });

  it("someone without approval rights gets FORBIDDEN, not the BU Admin message", async () => {
    const id = await submitted();
    await db.update(users).set({ isActive: false }).where(eq(users.email, "buadmin.land@demo.wct.my"));
    await expect(act("lnd1@demo.wct.my", id, { type: "APPROVE" })).rejects.toBeInstanceOf(WorkflowError);
  });

  it("BU Admin rejects → RETURNED; requester emailed, HOD copied", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    notifier.mockClear();
    const r = await act("buadmin.land@demo.wct.my", id, { type: "REJECT", remark: "Budget not in BU plan" });
    expect(r.status).toBe("RETURNED");
    const rc = ccOf(0);
    expect(rc.to.map((p) => p.email)).toEqual(["requester@demo.wct.my"]);
    expect(rc.cc.map((p) => p.email)).toEqual(["hod.land@demo.wct.my"]);
  });

  it("HR rejection after a full round copies HOD, BU Admin and the L&D approver", async () => {
    const id = await submitted("requester.enc@demo.wct.my");
    await act("hod.enc@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.enc@demo.wct.my", id, { type: "APPROVE" });
    await act("lnd1@demo.wct.my", id, { type: "APPROVE" });
    notifier.mockClear();
    const r = await act("hrhead@demo.wct.my", id, { type: "REJECT", remark: "Check vendor quote", sendBackTo: "LND" });
    expect(r.status).toBe("RETURNED");
    expect(ccOf(0).cc.map((p) => p.email).sort()).toEqual(["buadmin.enc@demo.wct.my", "hod.enc@demo.wct.my", "lnd1@demo.wct.my"]);
    const [a] = await db.select().from(requestActions).where(eq(requestActions.action, "REJECT"));
    expect(a.sentBackTo).toBe("REQUESTER");
  });

  it("only this round's approvers are copied after a resubmit", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.land@demo.wct.my", id, { type: "REJECT", remark: "Budget not in BU plan" });
    await act("requester@demo.wct.my", id, { type: "RESUBMIT" });
    notifier.mockClear();
    await act("hod.land@demo.wct.my", id, { type: "REJECT", remark: "Wrong dates" });
    expect(ccOf(0).cc).toEqual([]);
  });

  it("HOD approval emails the BU Admin; BU approval emails L&D", async () => {
    const id = await submitted();
    notifier.mockClear();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    expect(ccOf(0).to.map((p) => p.email)).toEqual(["buadmin.land@demo.wct.my"]);
    await act("buadmin.land@demo.wct.my", id, { type: "APPROVE" });
    expect(ccOf(1).to.map((p) => p.email).sort()).toEqual(["lnd1@demo.wct.my", "lnd2@demo.wct.my"]);
  });

  it("the BU Admin's awaiting-action list contains the PENDING_BU request", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    const bua = await asUser("buadmin.land@demo.wct.my");
    const rows = await db.select({ id: trainingRequests.id }).from(trainingRequests).where(await awaitingActionWhere(bua));
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it("returned request is edited and resubmitted as revision 2, restarting at HOD", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "REJECT", remark: "Change venue" });
    const req = await asUser("requester@demo.wct.my");
    await updateContent(req, id, await versionOf(id), { ...validDraft, venue: "Online (Teams)" });
    const r = await act("requester@demo.wct.my", id, { type: "RESUBMIT" });
    expect(r.status).toBe("PENDING_HOD");
    const revs = await db.select().from(requestRevisions).where(eq(requestRevisions.requestId, id));
    expect(revs.map((x) => x.revisionNo).sort()).toEqual([1, 2]);
    expect((revs.find((x) => x.revisionNo === 2)!.snapshot as { venue: string }).venue).toBe("Online (Teams)");
  });

  it("content cannot be edited while pending", async () => {
    const id = await submitted();
    const req = await asUser("requester@demo.wct.my");
    await expect(updateContent(req, id, await versionOf(id), validDraft)).rejects.toBeInstanceOf(WorkflowError);
  });
});

describe("concurrency", () => {
  it("second approver with the same version gets StaleVersionError naming the first", async () => {
    const id = await submitted();
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    await act("buadmin.land@demo.wct.my", id, { type: "APPROVE" });
    const v = await versionOf(id);
    const [a, b] = [await asUser("lnd1@demo.wct.my"), await asUser("lnd2@demo.wct.my")];
    const results = await Promise.allSettled([
      performAction(a, { requestId: id, version: v, type: "APPROVE" }),
      performAction(b, { requestId: id, version: v, type: "APPROVE" }),
    ]);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(StaleVersionError);
    expect(String(rejected[0].reason.message)).toMatch(/Nurul Izzah|Kevin Ong/);
    const approvals = (await db.select().from(requestActions).where(eq(requestActions.requestId, id))).filter(
      (x) => x.action === "APPROVE",
    );
    expect(approvals).toHaveLength(3); // HOD + BU Admin + one L&D
  });

  it("ten parallel ref allocations are distinct", async () => {
    const refs = await Promise.all(Array.from({ length: 10 }, () => db.transaction((tx) => allocateRefNo(tx, 2031))));
    expect(new Set(refs).size).toBe(10);
  });
});

describe("guards", () => {
  it("refuses submit when the department has no HOD and keeps it as draft", async () => {
    const [d] = await db.select().from(departments).where(eq(departments.name, "Land – Project Management"));
    await db.update(departments).set({ hodUserId: null }).where(eq(departments.id, d.id));
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(act("requester@demo.wct.my", id, { type: "SUBMIT" })).rejects.toBeInstanceOf(NoHodError);
    const [r] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, id));
    expect(r.status).toBe("DRAFT");
  });

  it("refuses submit when the requester has no department", async () => {
    await db.update(users).set({ departmentId: null }).where(eq(users.email, "requester@demo.wct.my"));
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, validDraft);
    await expect(act("requester@demo.wct.my", id, { type: "SUBMIT" })).rejects.toBeInstanceOf(NoDepartmentError);
  });

  it("refuses submit of an incomplete draft with field issues", async () => {
    const req = await asUser("requester@demo.wct.my");
    const { id } = await createDraft(req, { title: "Only a title", candidates: [] });
    const err = await act("requester@demo.wct.my", id, { type: "SUBMIT" }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect(Object.keys(err.fieldErrors)).toContain("venue");
  });

  it("HOD reassignment: new HOD sees it in the inbox; old HOD can no longer act", async () => {
    const id = await submitted();
    const newHod = await asUser("hod.malls@demo.wct.my");
    await db.update(departments).set({ hodUserId: newHod.id }).where(eq(departments.name, "Land – Project Management"));
    const refreshedNewHod = await asUser("hod.malls@demo.wct.my");
    const inbox = await db.select({ id: trainingRequests.id }).from(trainingRequests).where(await awaitingActionWhere(refreshedNewHod));
    expect(inbox.map((r) => r.id)).toContain(id);
    const err = await act("hod.land@demo.wct.my", id, { type: "APPROVE" }).catch((e) => e);
    expect(err instanceof WorkflowError || err instanceof NotFoundError).toBe(true);
  });

  it("another department's staff cannot load the request (IDOR → null)", async () => {
    const id = await submitted();
    expect(await getRequestForUser(await asUser("requester.malls@demo.wct.my"), id)).toBeNull();
    expect(await getRequestForUser(await asUser("buadmin.malls@demo.wct.my"), id)).toBeNull();
    expect(await getRequestForUser(await asUser("buadmin.land@demo.wct.my"), id)).not.toBeNull();
  });

  it("notifier failure never blocks the action", async () => {
    setNotifier(async () => {
      throw new Error("flow down");
    });
    const id = await submitted();
    const [r] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, id));
    expect(r.status).toBe("PENDING_HOD");
  });
});

describe("L&D fields, comments, clone", () => {
  it("L&D can set HRD Corp fields at PENDING_LND only", async () => {
    const id = await submitted();
    const lnd = await asUser("lnd1@demo.wct.my");
    await expect(updateLndFields(lnd, id, await versionOf(id), { hrdcClaimable: true })).rejects.toBeInstanceOf(WorkflowError);
    await act("hod.land@demo.wct.my", id, { type: "APPROVE" });
    await expect(updateLndFields(lnd, id, await versionOf(id), { hrdcClaimable: true })).rejects.toBeInstanceOf(WorkflowError);
    await act("buadmin.land@demo.wct.my", id, { type: "APPROVE" });
    await updateLndFields(lnd, id, await versionOf(id), { hrdcClaimable: true, hrdcGrantNo: "HRDC-2026-55" });
    const [r] = await db.select().from(trainingRequests).where(eq(trainingRequests.id, id));
    expect(r.hrdcGrantNo).toBe("HRDC-2026-55");
  });

  it("comments notify and appear on the request", async () => {
    const id = await submitted();
    const hod = await asUser("hod.land@demo.wct.my");
    await addComment(hod, id, "Is this covered by the annual plan?");
    const detail = await getRequestForUser(hod, id);
    expect(detail?.comments[0].body).toBe("Is this covered by the annual plan?");
    expect(notifier).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ kind: "COMMENTED" }) }));
  });

  it("clone creates a new draft owned by the cloner with the same candidates", async () => {
    const id = await submitted();
    const req = await asUser("requester@demo.wct.my");
    const { id: newId } = await cloneRequest(req, id);
    const detail = await getRequestForUser(req, newId);
    expect(detail?.request.status).toBe("DRAFT");
    expect(detail?.request.refNo).toBeNull();
    expect(detail?.candidates).toHaveLength(2);
  });
});
