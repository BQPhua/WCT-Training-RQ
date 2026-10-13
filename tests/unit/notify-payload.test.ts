import { describe, expect, it, vi } from "vitest";
import { buildPayload } from "@/lib/notify/payload";

const base = {
  event: { kind: "REJECTED" as const, fromStatus: "PENDING_HR" as const, actorId: "u-hr", byStage: "HR" as const, sentBackTo: "LND" as const },
  request: { id: "abc", refNo: "TRQ-2026-0007", title: "Excel <script>alert(1)</script>", status: "PENDING_LND" as const, startDate: "2026-11-02", endDate: "2026-11-03", venue: "WCT Tower" },
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
    expect(buildPayload(base).subject).toBe("[Training RQ] TRQ-2026-0007 – Rejected (sent back to L&D Team): Excel <script>alert(1)</script>");
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
    expect(p.statusLabel).toBe("Pending L&D");
  });

  it("uses 'Draft' when there is no ref no", () => {
    expect(buildPayload({ ...base, request: { ...base.request, refNo: null } }).subject).toContain("Draft –");
  });
});
