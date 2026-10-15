import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/same-origin";

const APP = "https://hrforms.wct.my/WCT-Training-RQ";

describe("isSameOrigin", () => {
  it("accepts the app's own origin", () => {
    expect(isSameOrigin("https://hrforms.wct.my", APP)).toBe(true);
  });
  it("rejects other sites, other schemes, missing and junk headers", () => {
    expect(isSameOrigin("https://evil.example", APP)).toBe(false);
    expect(isSameOrigin("http://hrforms.wct.my", APP)).toBe(false);
    expect(isSameOrigin("https://hrforms.wct.my.evil.example", APP)).toBe(false);
    expect(isSameOrigin(null, APP)).toBe(false);
    expect(isSameOrigin("null", APP)).toBe(false);
  });
});
