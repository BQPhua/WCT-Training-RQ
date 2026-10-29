import { describe, expect, it, vi } from "vitest";
import { buildPayload } from "@/lib/notify/payload";

const base = {
  event: { kind: "REJECTED" as const, fromStatus: "PENDING_HR" as const, actorId: "u-hr", byStage: "HR" as const, sentBackTo: "REQUESTER" as const },
  request: { id: "abc", refNo: "TRQ-2026-0007", title: "Excel <script>alert(1)</script>", status: "RETURNED" as const, startDate: "2026-11-02", endDate: "2026-11-03", venue: "WCT Tower" },
  requester: { id: "u1", name: "Aisyah Rahman", email: "aisyah@wct.my" },
  actor: { id: "u-hr", name: "Farah Hanim", email: "farah@wct.my" },
  recipients: { to: [{ id: "u2", name: "Nurul", email: "nurul@wct.my" }], cc: [] },
  remark: "Please <b>check</b> the quote",
};

describe("buildPayload", () => {
  it("links to the request under the base path", () => {
    vi.stubEnv("APP_URL", "https://hrforms.wct.my/WCT-Training-RQ");
    expect(buildPayload(base).link).toBe("https://hrforms.wct.my/WCT-Training-RQ/requests/abc");
  });

  it("formats the subject", () => {
    expect(buildPayload(base).subject).toBe("[Training RQ] TRQ-2026-0007 – Rejected (returned to requester): Excel <script>alert(1)</script>");
  });

  it("escapes HTML in title and remark", () => {
    const html = buildPayload(base).messageHtml;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;check&lt;/b&gt;");
  });

  it("flattens recipients to email arrays", () => {
    const p = buildPayload(base);
    expect(p.to).toEqual(["nurul@wct.my"]);
    expect(p.cc).toEqual([]);
    expect(p.event).toBe("REJECTED");
    expect(p.statusLabel).toBe("Returned");
  });

  it("uses 'Draft' when there is no ref no", () => {
    expect(buildPayload({ ...base, request: { ...base.request, refNo: null } }).subject).toContain("Draft –");
  });

  it("HOD approval headline names the BU Admin step", () => {
    const html = buildPayload({ ...base, businessUnit: "Land", event: { kind: "HOD_APPROVED", fromStatus: "PENDING_HOD", actorId: "u-hod" }, actor: { id: "u-hod", name: "Tan Wei Ming", email: "tan@wct.my" } }).messageHtml;
    expect(html).toContain("The Department HOD (Tan Wei Ming) has approved this training request. It is now with the Land BU Admin for approval.");
  });

  it("final approval by L&D names the L&D Team, not the HR Head", () => {
    const html = buildPayload({ ...base, businessUnit: "Malls", event: { kind: "FINAL_APPROVED", fromStatus: "PENDING_LND", actorId: "u-lnd" }, actor: { id: "u-lnd", name: "Nurul Izzah", email: "nurul@wct.my" } }).messageHtml;
    expect(html).toContain("This training request has received final approval from the L&amp;D Team (Nurul Izzah).");
    expect(html).not.toContain("HR Head");
  });

  it("final approval by HR Head still names the HR Head", () => {
    const html = buildPayload({ ...base, event: { kind: "FINAL_APPROVED", fromStatus: "PENDING_HR", actorId: "u-hr" } }).messageHtml;
    expect(html).toContain("This training request has received final approval from the HR Head (Farah Hanim).");
  });

  it("BU approval headline hands over to L&D", () => {
    const p = buildPayload({ ...base, businessUnit: "Land", event: { kind: "BU_APPROVED", fromStatus: "PENDING_BU", actorId: "u-bua" }, actor: { id: "u-bua", name: "Lee Mei Ling", email: "lee@wct.my" } });
    expect(p.messageHtml).toContain("The Land BU Admin (Lee Mei Ling) has approved this training request. It is now with the L&amp;D Team for review.");
    expect(p.subject).toContain("Approved by BU Admin");
  });

  it("rejection headline says it returns to the requester", () => {
    expect(buildPayload(base).messageHtml).toContain("Farah Hanim has rejected this training request and returned it to the requester for amendment.");
  });

  it("labels the dates row Training Dates", () => {
    expect(buildPayload(base).messageHtml).toContain(">Training Dates<");
  });
});
