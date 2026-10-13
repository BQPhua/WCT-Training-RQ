import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevLoginEnabled, parseEmailList, BASE_PATH } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDevLoginEnabled", () => {
  it("is true only in development with AUTH_DEV_LOGIN=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_LOGIN", "true");
    expect(isDevLoginEnabled()).toBe(true);
  });

  it("is false in production even when the flag is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DEV_LOGIN", "true");
    expect(isDevLoginEnabled()).toBe(false);
  });

  it("is false in development when the flag is not 'true'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_LOGIN", "yes");
    expect(isDevLoginEnabled()).toBe(false);
  });
});

describe("parseEmailList", () => {
  it("lowercases, trims and drops empties", () => {
    expect(parseEmailList("A@x.my, b@x.my ,,")).toEqual(["a@x.my", "b@x.my"]);
  });

  it("returns [] for undefined", () => {
    expect(parseEmailList(undefined)).toEqual([]);
  });
});

describe("BASE_PATH", () => {
  it("is the production sub-path", () => {
    expect(BASE_PATH).toBe("/WCT-Training-RQ");
  });
});
