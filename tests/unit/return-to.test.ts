import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/lib/auth/return-to";

describe("safeReturnTo", () => {
  it("keeps an in-app path", () => {
    expect(safeReturnTo("/requests/abc?tab=timeline")).toBe("/requests/abc?tab=timeline");
  });
  it.each(["//evil.com", "https://evil.com/x", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "requests"])(
    "falls back to /dashboard for %s",
    (v) => {
      expect(safeReturnTo(v as string | null | undefined)).toBe("/dashboard");
    },
  );
  it("strips the base path if included", () => {
    expect(safeReturnTo("/WCT-Training-RQ/history")).toBe("/history");
  });
});

import { signinPath } from "@/lib/auth/return-to";

describe("signinPath", () => {
  it("carries the original page so sign-in returns there", () => {
    expect(signinPath("/requests/abc?x=1")).toBe("/signin?returnTo=%2Frequests%2Fabc%3Fx%3D1");
  });
  it("drops unsafe or missing targets", () => {
    expect(signinPath(null)).toBe("/signin");
    expect(signinPath("//evil.com")).toBe("/signin");
    expect(signinPath("/dashboard")).toBe("/signin");
  });
});
