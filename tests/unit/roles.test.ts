import { describe, expect, it } from "vitest";
import { isDemoUser, isSystemAdmin } from "@/lib/auth/roles";

const u = (roles: ("LND" | "HR_HEAD" | "SYS_ADMIN")[]) => ({ actor: { roles } });

describe("isSystemAdmin", () => {
  it("is true for the L&D team and System Admins", () => {
    expect(isSystemAdmin(u(["LND"]))).toBe(true);
    expect(isSystemAdmin(u(["SYS_ADMIN"]))).toBe(true);
  });
  it("is false for other roles", () => {
    expect(isSystemAdmin(u(["HR_HEAD"]))).toBe(false);
    expect(isSystemAdmin(u([]))).toBe(false);
  });
});

describe("isDemoUser", () => {
  it("matches the demo domain, ignoring case", () => {
    expect(isDemoUser({ email: "lnd1@demo.wct.my" })).toBe(true);
    expect(isDemoUser({ email: "HRHEAD@DEMO.WCT.MY" })).toBe(true);
  });
  it("does not match real staff or look-alike domains", () => {
    expect(isDemoUser({ email: "phua@wct.my" })).toBe(false);
    expect(isDemoUser({ email: "x@evil-demo.wct.my.com" })).toBe(false);
    expect(isDemoUser({ email: "x@notdemo.wct.my" })).toBe(false);
  });
});
