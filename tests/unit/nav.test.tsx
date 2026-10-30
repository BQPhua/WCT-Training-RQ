import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Nav } from "@/components/shell/nav";

describe("Nav", () => {
  it("collapsed: the approvals count becomes a red dot labelled for screen readers; labels stay for screen readers", () => {
    const html = renderToStaticMarkup(<Nav approvals={2} isAdmin collapsed />);
    expect(html).toContain('role="img" aria-label="2 awaiting your action"');
    expect(html).toMatch(/class="[^"]*sr-only[^"]*">Approvals</);
  });

  it("expanded: the approvals count is shown as a number", () => {
    const html = renderToStaticMarkup(<Nav approvals={2} isAdmin />);
    expect(html).toMatch(/aria-label="2 awaiting your action"[^>]*>2</);
    expect(html).not.toContain('role="img"');
  });

  it("no approvals waiting: no badge or dot", () => {
    expect(renderToStaticMarkup(<Nav approvals={0} isAdmin collapsed />)).not.toContain("awaiting your action");
  });
});
