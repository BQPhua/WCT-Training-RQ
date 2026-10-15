import { describe, expect, it } from "vitest";
import { isJsonContentType } from "@/lib/content-type";

describe("isJsonContentType", () => {
  it("accepts application/json, with or without parameters", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
  });
  it("rejects simple (no-preflight) types that merely mention JSON", () => {
    expect(isJsonContentType("text/plain; x=application/json")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});
