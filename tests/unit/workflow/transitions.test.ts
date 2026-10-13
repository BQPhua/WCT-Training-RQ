import { describe, expect, it } from "vitest";
import { getAllowedActions, transition, WorkflowError, sendBackOptions } from "@/lib/workflow";
import { admin, counts, hodLand, hodMalls, hr, lnd, req, requester, stranger, DEPT_LAND } from "./fixtures";

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
  it("HOD of the request's department approves to PENDING_LND", () => {
    const r = transition(req("PENDING_HOD"), hodLand, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_LND");
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
    expect(transition(req("PENDING_HOD"), newHod, { type: "APPROVE" }, counts).toStatus).toBe("PENDING_LND");
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

  it("HOD cannot send back to L&D", () => {
    expect(
      code(() => transition(req("PENDING_HOD"), hodLand, { type: "REJECT", remark: "Not valid", sendBackTo: "LND" }, counts)),
    ).toBe("INVALID_SEND_BACK");
  });
});

describe("L&D stage", () => {
  it("offers send back to requester or HOD", () => {
    expect(sendBackOptions("PENDING_LND")).toEqual(["REQUESTER", "HOD"]);
    const reject = getAllowedActions(req("PENDING_LND"), lnd, counts).find((a) => a.type === "REJECT");
    expect(reject?.sendBackOptions).toEqual(["REQUESTER", "HOD"]);
  });

  it("approve moves to PENDING_HR", () => {
    const r = transition(req("PENDING_LND"), lnd, { type: "APPROVE" }, counts);
    expect(r.toStatus).toBe("PENDING_HR");
    expect(r.event.kind).toBe("LND_APPROVED");
  });

  it("reject with send back to HOD returns to PENDING_HOD", () => {
    const r = transition(
      req("PENDING_LND"),
      lnd,
      { type: "REJECT", remark: "HOD to confirm budget", sendBackTo: "HOD", notify: ["REQUESTER"] },
      counts,
    );
    expect(r.toStatus).toBe("PENDING_HOD");
    expect(r.event.sentBackTo).toBe("HOD");
    expect(r.event.notify).toEqual(["REQUESTER"]);
  });

  it("non-L&D user is forbidden", () => {
    expect(code(() => transition(req("PENDING_LND"), hodLand, { type: "APPROVE" }, counts))).toBe("FORBIDDEN");
  });
});

describe("HR Head stage", () => {
  it("offers send back to requester, HOD or L&D", () => {
    expect(sendBackOptions("PENDING_HR")).toEqual(["REQUESTER", "HOD", "LND"]);
  });

  it.each([
    ["REQUESTER", "RETURNED"],
    ["HOD", "PENDING_HOD"],
    ["LND", "PENDING_LND"],
  ] as const)("reject sending back to %s → %s", (stage, status) => {
    const r = transition(req("PENDING_HR"), hr, { type: "REJECT", remark: "Please revise", sendBackTo: stage }, counts);
    expect(r.toStatus).toBe(status);
  });

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

  it.each(["DRAFT", "PENDING_HOD", "PENDING_LND", "PENDING_HR", "RETURNED"] as const)(
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
    expect(getAllowedActions(req("PENDING_LND"), self, { lnd: 2, hrHead: 1 }).map((a) => a.type)).not.toContain(
      "APPROVE",
    );
    expect(code(() => transition(req("PENDING_LND"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 1 }))).toBe(
      "FORBIDDEN",
    );
  });

  it("sole L&D member may act on own request, flagged self-approved", () => {
    const self = { ...requester, roles: ["LND" as const] };
    const r = transition(req("PENDING_LND"), self, { type: "APPROVE" }, { lnd: 1, hrHead: 1 });
    expect(r.selfApproved).toBe(true);
  });

  it("sole HR Head may approve own request; blocked when another HR Head exists", () => {
    const self = { ...requester, roles: ["HR_HEAD" as const] };
    expect(transition(req("PENDING_HR"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 1 }).selfApproved).toBe(true);
    expect(code(() => transition(req("PENDING_HR"), self, { type: "APPROVE" }, { lnd: 2, hrHead: 2 }))).toBe(
      "FORBIDDEN",
    );
  });
});

describe("getAllowedActions", () => {
  it("system admin alone has no approval actions", () => {
    for (const s of ["PENDING_HOD", "PENDING_LND", "PENDING_HR"] as const) {
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
