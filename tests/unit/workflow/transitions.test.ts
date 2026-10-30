import { describe, expect, it } from "vitest";
import { getAllowedActions, transition, WorkflowError } from "@/lib/workflow";
import { admin, buAdminLand, buAdminMalls, counts, hodLand, hodMalls, hr, lnd, req, requester, stranger, BU_LAND, DEPT_LAND } from "./fixtures";

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof WorkflowError) return e.code;
    throw e;
  }
  return undefined;
}

describe("submit", () => {
  it("requester submits a draft to PENDING_HOD", () => {
    const r = transition(req("DRAFT"), requester, { type: "SUBMIT" }, counts);
    expect(r.toStatus).toBe("PENDING_HOD");
    expect(r.event.kind).toBe("SUBMITTED");
  });

  it("someone else cannot submit", () => {
    expect(code(() => transition(req("DRAFT"), hodLand, { type: "SUBMIT" }, counts))).toBe("FORBIDDEN");
  });

  it("cannot submit a request that is already pending", () => {
    expect(code(() => transition(req("PENDING_HOD"), requester, { type: "SUBMIT" }, counts))).toBe("INVALID_STATE");
  });
});

describe("HOD stage", () => {
  it("HOD of the request's department approves to PENDING_BU", () => {
    const r = transition(req("PENDING_HOD"), hodLand, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_BU");
    expect(r.event.kind).toBe("HOD_APPROVED");
    expect(r.selfApproved).toBe(false);
  });

  it("HOD of another department is forbidden", () => {
    expect(code(() => transition(req("PENDING_HOD"), hodMalls, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });

  it("a former HOD loses rights once the mapping changes; the new HOD gains them", () => {
    const formerHod = { ...hodLand, hodDepartmentIds: [] };
    const newHod = { ...hodMalls, hodDepartmentIds: [DEPT_LAND] };
    expect(code(() => transition(req("PENDING_HOD"), formerHod, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
    expect(transition(req("PENDING_HOD"), newHod, { type: "APPROVE" }, counts).toStatus).toBe("PENDING_BU");
  });

  it("reject requires a remark of at least 3 characters", () => {
    expect(code(() => transition(req("PENDING_HOD"), hodLand, { type: "REJECT", remark: "  " }, counts))).toBe(
      "REMARK_REQUIRED",
    );
    expect(code(() => transition(req("PENDING_HOD"), hodLand, { type: "REJECT", remark: " ok " }, counts))).toBe(
      "REMARK_REQUIRED",
    );
  });

  it("HOD reject returns to the requester", () => {
    const r = transition(req("PENDING_HOD"), hodLand, { type: "REJECT", remark: "Wrong dates" }, counts);
    expect(r.toStatus).toBe("RETURNED");
    expect(r.event.sentBackTo).toBe("REQUESTER");
    expect(r.event.kind).toBe("REJECTED");
    expect(r.event.byStage).toBe("HOD");
  });

});

describe("BU Admin stage", () => {
  it("BU Admin of the request's business unit approves to PENDING_LND", () => {
    const r = transition(req("PENDING_BU"), buAdminLand, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_LND");
    expect(r.event.kind).toBe("BU_APPROVED");
    expect(r.selfApproved).toBe(false);
  });

  it("BU Admin of another business unit is forbidden", () => {
    expect(code(() => transition(req("PENDING_BU"), buAdminMalls, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });

  it("HOD cannot act at the BU stage", () => {
    expect(code(() => transition(req("PENDING_BU"), hodLand, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });

  it("sole BU Admin may approve own request (self-approved); blocked when another BU Admin exists", () => {
    const self = { ...requester, buAdminBusinessUnitIds: [BU_LAND] };
    expect(transition(req("PENDING_BU"), self, { type: "APPROVE" }, { ...counts, buAdmin: 1 }).selfApproved).toBe(true);
    expect(code(() => transition(req("PENDING_BU"), self, { type: "APPROVE" }, { ...counts, buAdmin: 2 }))).toBe("FORBIDDEN");
  });
});

describe("reject always returns to the requester", () => {
  it.each([
    ["PENDING_HOD", hodLand, "HOD"],
    ["PENDING_BU", buAdminLand, "BU"],
    ["PENDING_LND", lnd, "LND"],
    ["PENDING_HR", hr, "HR"],
  ] as const)("reject at %s → RETURNED", (status, actor, stage) => {
    const r = transition(req(status), actor, { type: "REJECT", remark: "Please revise" }, counts);
    expect(r.toStatus).toBe("RETURNED");
    expect(r.event.kind).toBe("REJECTED");
    expect(r.event.sentBackTo).toBe("REQUESTER");
    expect(r.event.byStage).toBe(stage);
  });

  it("allowed REJECT carries no send-back options", () => {
    const reject = getAllowedActions(req("PENDING_HR"), hr, counts).find((a) => a.type === "REJECT");
    expect(reject).toEqual({ type: "REJECT" });
  });
});

describe("L&D stage", () => {
  it("approve moves to PENDING_HR", () => {
    const r = transition(req("PENDING_LND"), lnd, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_HR");
    expect(r.event.kind).toBe("LND_APPROVED");
  });

  it("non-L&D user is forbidden", () => {
    expect(code(() => transition(req("PENDING_LND"), hodLand, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });

  it("L&D approval goes to PENDING_HR when requiresHrApproval", () => {
    const r = transition(req("PENDING_LND", { requiresHrApproval: true }), lnd, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_HR");
    expect(r.event.kind).toBe("LND_APPROVED");
  });

  it("L&D approval is final when HR approval is not required", () => {
    const r = transition(req("PENDING_LND", { requiresHrApproval: false }), lnd, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("APPROVED");
    expect(r.event.kind).toBe("FINAL_APPROVED");
  });

  it("HR Head can still approve PENDING_HR when the flag is false", () => {
    const r = transition(req("PENDING_HR", { requiresHrApproval: false }), hr, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("APPROVED");
    expect(r.event.kind).toBe("FINAL_APPROVED");
  });

  it("allowed actions at PENDING_LND do not depend on the flag", () => {
    const types = (flag: boolean) => getAllowedActions(req("PENDING_LND", { requiresHrApproval: flag }), lnd, counts).map((a) => a.type);
    expect(types(false)).toEqual(types(true));
  });
});

describe("BU Admin step switched off", () => {
  it("HOD approval goes straight to PENDING_LND, still HOD_APPROVED", () => {
    const r = transition(req("PENDING_HOD", { requiresBuAdmin: false }), hodLand, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_LND");
    expect(r.event.kind).toBe("HOD_APPROVED");
    expect(r.event.toStatus).toBe("PENDING_LND");
  });
  it("an in-flight PENDING_BU request can still be approved by the BU Admin", () => {
    const r = transition(req("PENDING_BU", { requiresBuAdmin: false }), buAdminLand, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_LND");
  });
});

describe("HR Head stage", () => {
  it("approve is final", () => {
    const r = transition(req("PENDING_HR"), hr, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("APPROVED");
    expect(r.event.kind).toBe("FINAL_APPROVED");
  });

  it("L&D cannot act at HR stage", () => {
    expect(code(() => transition(req("PENDING_HR"), lnd, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });
});

describe("resubmit and cancel", () => {
  it("requester resubmits a returned request to PENDING_HOD", () => {
    const r = transition(req("RETURNED"), requester, { type: "RESUBMIT" }, counts);
    expect(r.toStatus).toBe("PENDING_HOD");
    expect(r.event.kind).toBe("RESUBMITTED");
  });

  it.each(["DRAFT", "PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR", "RETURNED"] as const)(
    "requester can cancel from %s with a remark",
    (status) => {
      const r = transition(req(status), requester, { type: "CANCEL", remark: "No longer needed" }, counts);
      expect(r.toStatus).toBe("CANCELLED");
      expect(r.event.fromStatus).toBe(status);
    },
  );

  it("cannot cancel an approved request", () => {
    expect(code(() => transition(req("APPROVED"), requester, { type: "CANCEL", remark: "oops!" }, counts))).toBe(
      "INVALID_STATE",
    );
  });

  it("cancel requires a remark", () => {
    expect(code(() => transition(req("PENDING_HOD"), requester, { type: "CANCEL" }, counts))).toBe("REMARK_REQUIRED");
  });

  it("only the requester can cancel", () => {
    expect(code(() => transition(req("PENDING_HOD"), hodLand, { type: "CANCEL", remark: "nope" }, counts))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("self-approval rules", () => {
  it("requester who is the HOD of their own department may approve, flagged self-approved", () => {
    const self = { ...requester, hodDepartmentIds: [DEPT_LAND] };
    const r = transition(req("PENDING_HOD"), self, { type: "APPROVE" }, counts);
    expect(r.selfApproved).toBe(true);
  });

  it("L&D member cannot act on own request when another L&D member exists", () => {
    const self = { ...requester, roles: ["LND" as const] };
    expect(getAllowedActions(req("PENDING_LND"), self, { lnd: 2, hrHead: 1, buAdmin: 1 }).map((a) => a.type)).not.toContain(
      "APPROVE",
    );
    expect(code(() => transition(req("PENDING_LND"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 1, buAdmin: 1 }))).toBe(
      "FORBIDDEN",
    );
  });

  it("sole L&D member may act on own request, flagged self-approved", () => {
    const self = { ...requester, roles: ["LND" as const] };
    const r = transition(req("PENDING_LND"), self, { type: "APPROVE" }, { lnd: 1, hrHead: 1, buAdmin: 1 });
    expect(r.selfApproved).toBe(true);
  });

  it("sole HR Head may approve own request; blocked when another HR Head exists", () => {
    const self = { ...requester, roles: ["HR_HEAD" as const] };
    expect(transition(req("PENDING_HR"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 1, buAdmin: 1 }).selfApproved).toBe(true);
    expect(code(() => transition(req("PENDING_HR"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 2, buAdmin: 1 }))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("getAllowedActions", () => {
  it("system admin alone has no approval actions", () => {
    for (const s of ["PENDING_HOD", "PENDING_BU", "PENDING_LND", "PENDING_HR"] as const) {
      expect(getAllowedActions(req(s), admin, counts)).toEqual([]);
    }
  });

  it("requester sees SUBMIT and CANCEL on a draft", () => {
    expect(getAllowedActions(req("DRAFT"), requester, counts).map((a) => a.type).sort()).toEqual(["CANCEL", "SUBMIT"]);
  });

  it("requester sees RESUBMIT and CANCEL when returned", () => {
    expect(getAllowedActions(req("RETURNED"), requester, counts).map((a) => a.type).sort()).toEqual([
      "CANCEL",
      "RESUBMIT",
    ]);
  });

  it("nobody has actions on terminal statuses", () => {
    for (const a of [requester, hodLand, lnd, hr, admin, stranger]) {
      expect(getAllowedActions(req("APPROVED"), a, counts)).toEqual([]);
      expect(getAllowedActions(req("CANCELLED"), a, counts)).toEqual([]);
    }
  });
});
