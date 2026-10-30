import { describe, expect, it } from "vitest";
import { nextStatusAfter, routeOf } from "@/lib/workflow/route";

describe("routeOf", () => {
  it.each([
    [{ requiresBuAdmin: true, requiresHrApproval: true }, ["HOD", "BU", "LND", "HR"]],
    [{ requiresBuAdmin: true, requiresHrApproval: false }, ["HOD", "BU", "LND"]],
    [{ requiresBuAdmin: false, requiresHrApproval: true }, ["HOD", "LND", "HR"]],
    [{ requiresBuAdmin: false, requiresHrApproval: false }, ["HOD", "LND"]],
    [{}, ["HOD", "BU", "LND", "HR"]],
  ])("%j → %j", (flags, stages) => {
    expect(routeOf(flags)).toEqual(stages);
  });
});

describe("nextStatusAfter", () => {
  it("HOD → L&D when the BU Admin step is off", () => {
    expect(nextStatusAfter("PENDING_HOD", { requiresBuAdmin: false })).toBe("PENDING_LND");
  });
  it("HOD → BU Admin by default", () => {
    expect(nextStatusAfter("PENDING_HOD", {})).toBe("PENDING_BU");
  });
  it("an in-flight PENDING_BU request moves on to L&D even when the step is now off", () => {
    expect(nextStatusAfter("PENDING_BU", { requiresBuAdmin: false })).toBe("PENDING_LND");
  });
  it("L&D → Approved when HR is off; HR → Approved always", () => {
    expect(nextStatusAfter("PENDING_LND", { requiresHrApproval: false })).toBe("APPROVED");
    expect(nextStatusAfter("PENDING_LND", {})).toBe("PENDING_HR");
    expect(nextStatusAfter("PENDING_HR", { requiresHrApproval: false })).toBe("APPROVED");
  });
});
