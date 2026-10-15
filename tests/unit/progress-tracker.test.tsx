import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressTracker, type TrackerStation } from "@/components/request-detail/progress-tracker";

const station = (key: string): TrackerStation => ({ key, label: key, state: "upcoming" });

describe("ProgressTracker", () => {
  it("lays every station out on one row (one column per station)", () => {
    const stations = ["submit", "hod", "bu", "lnd", "hr", "final"].map(station);
    const html = renderToStaticMarkup(<ProgressTracker stations={stations} status="PENDING_HOD" />);
    expect(html).toContain("--stations:6");
    expect(html).not.toContain("sm:grid-cols-5");
  });
});
