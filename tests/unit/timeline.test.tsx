import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline, type TimelineAction } from "@/components/request-detail/timeline";

const html = (actions: TimelineAction[]) => renderToStaticMarkup(<Timeline actions={actions} />).replaceAll("&amp;", "&");
const a = (over: Partial<TimelineAction>): TimelineAction => ({
  id: "1",
  action: "APPROVE",
  fromStatus: "PENDING_LND",
  toStatus: "APPROVED",
  sentBackTo: null,
  remark: null,
  selfApproved: false,
  notified: null,
  createdAt: new Date(2026, 9, 1, 9, 0),
  actor: { name: "Nurul" },
  ...over,
});

describe("Timeline", () => {
  it('labels an L&D approval that finalises the request "Final approval (L&D)"', () => {
    expect(html([a({})])).toContain("Final approval (L&D)");
  });

  it("an L&D approval that passes the request on is not labelled final", () => {
    expect(html([a({ toStatus: "PENDING_HR" })])).not.toContain("Final approval");
  });
});
