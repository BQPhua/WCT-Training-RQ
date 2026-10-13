import { describe, expect, it } from "vitest";
import { actionSchema, draftSchema, lndFieldsSchema, requestFormSchema } from "@/lib/validation/request";

const valid = {
  trainingType: "PLANNED",
  title: "Advanced Excel for Engineers",
  objective: "Improve reporting productivity",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  startTime: "09:00",
  endTime: "17:00",
  feePerPax: "1250.50",
  venue: "WCT Tower, Level 5",
  conductedBy: "ABC Training Sdn Bhd",
  candidates: [{ name: "Aisyah Rahman", email: "aisyah@wct.my" }],
};

function errorPaths(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("requestFormSchema", () => {
  it("accepts a complete request", () => {
    expect(requestFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects duplicate candidate emails", () => {
    const r = requestFormSchema.safeParse({
      ...valid,
      candidates: [
        { name: "A", email: "x@wct.my" },
        { name: "B", email: "X@wct.my" },
      ],
    });
    expect(errorPaths(r).some((m) => m.includes("Duplicate candidate"))).toBe(true);
  });

  it("rejects duplicate candidate names when no email", () => {
    const r = requestFormSchema.safeParse({ ...valid, candidates: [{ name: "Ali" }, { name: " ali " }] });
    expect(errorPaths(r).some((m) => m.includes("Duplicate candidate"))).toBe(true);
  });

  it("rejects more than 8 candidates", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `Person ${i}` }));
    expect(requestFormSchema.safeParse({ ...valid, candidates: many }).success).toBe(false);
  });

  it("requires at least one candidate", () => {
    expect(requestFormSchema.safeParse({ ...valid, candidates: [] }).success).toBe(false);
  });

  it("rejects end date before start date, on endDate", () => {
    const r = requestFormSchema.safeParse({ ...valid, endDate: "2026-11-01" });
    expect(errorPaths(r).some((m) => m.startsWith("endDate"))).toBe(true);
  });

  it("rejects end time not after start time, on endTime", () => {
    const r = requestFormSchema.safeParse({ ...valid, endTime: "08:00" });
    expect(errorPaths(r).some((m) => m.startsWith("endTime"))).toBe(true);
  });

  it("rejects fees with more than 2 decimal places", () => {
    expect(requestFormSchema.safeParse({ ...valid, feePerPax: "10.555" }).success).toBe(false);
  });

  it("rejects negative fees", () => {
    expect(requestFormSchema.safeParse({ ...valid, feePerPax: "-1" }).success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    expect(requestFormSchema.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
  });

  it("trims whitespace-only required fields as missing", () => {
    expect(requestFormSchema.safeParse({ ...valid, venue: "   " }).success).toBe(false);
  });
});

describe("draftSchema", () => {
  it("accepts a draft with only a title", () => {
    expect(draftSchema.safeParse({ title: "Draft idea", candidates: [] }).success).toBe(true);
  });

  it("still requires a title", () => {
    expect(draftSchema.safeParse({ title: "", candidates: [] }).success).toBe(false);
  });
});

describe("actionSchema", () => {
  it("accepts a reject with send back and notify", () => {
    const r = actionSchema.safeParse({
      requestId: "7d0f3c1e-1b2a-4c3d-8e9f-001122334455",
      version: 3,
      type: "REJECT",
      remark: "Please revise",
      sendBackTo: "HOD",
      notify: ["REQUESTER"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(actionSchema.safeParse({ requestId: "7d0f3c1e-1b2a-4c3d-8e9f-001122334455", version: 1, type: "DELETE" }).success).toBe(false);
  });
});

describe("lndFieldsSchema", () => {
  it("limits grant number to 50 chars", () => {
    expect(lndFieldsSchema.safeParse({ hrdcGrantNo: "x".repeat(51) }).success).toBe(false);
    expect(lndFieldsSchema.safeParse({ hrdcClaimable: true, hrdcGrantNo: "HRDC-123" }).success).toBe(true);
  });
});
