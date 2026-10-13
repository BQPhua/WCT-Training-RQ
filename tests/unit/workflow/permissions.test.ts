import { describe, expect, it } from "vitest";
import { canEditContent, canEditLndFields, canView } from "@/lib/workflow";
import { admin, buAdminLand, buAdminMalls, hodLand, hodMalls, hr, lnd, req, requester, stranger } from "./fixtures";

describe("canView", () => {
  it.each([
    ["requester", requester],
    ["HOD of the department", hodLand],
    ["BU Admin of the same BU", buAdminLand],
    ["L&D", lnd],
    ["HR Head", hr],
    ["System Admin", admin],
  ])("%s can view a submitted request", (_label, actor) => {
    expect(canView(req("PENDING_LND"), actor)).toBe(true);
  });

  it.each([
    ["HOD of another department", hodMalls],
    ["BU Admin of another BU", buAdminMalls],
    ["unrelated staff", stranger],
  ])("%s cannot view", (_label, actor) => {
    expect(canView(req("PENDING_LND"), actor)).toBe(false);
  });

  it("drafts are private to the requester", () => {
    expect(canView(req("DRAFT"), requester)).toBe(true);
    for (const a of [hodLand, buAdminLand, lnd, hr, admin]) expect(canView(req("DRAFT"), a)).toBe(false);
  });
});

describe("canEditContent", () => {
  it("requester can edit in DRAFT and RETURNED only", () => {
    expect(canEditContent(req("DRAFT"), requester)).toBe(true);
    expect(canEditContent(req("RETURNED"), requester)).toBe(true);
    expect(canEditContent(req("PENDING_HOD"), requester)).toBe(false);
    expect(canEditContent(req("APPROVED"), requester)).toBe(false);
  });

  it("others cannot edit content", () => {
    expect(canEditContent(req("DRAFT"), lnd)).toBe(false);
  });
});

describe("canEditLndFields", () => {
  it("L&D can edit L&D fields only at PENDING_LND", () => {
    expect(canEditLndFields(req("PENDING_LND"), lnd)).toBe(true);
    expect(canEditLndFields(req("PENDING_HR"), lnd)).toBe(false);
    expect(canEditLndFields(req("PENDING_LND"), hr)).toBe(false);
  });
});
