import { describe, expect, it } from "vitest";
import { routePanelRows } from "@/components/request-form/route-panel";

const who = { name: "Aisyah", hodName: "Tan", businessUnit: "Land", buAdminNames: "Lee" };

describe("routePanelRows", () => {
  it("full route: you, HOD, BU Admin, L&D, HR Head", () => {
    expect(routePanelRows({ ...who, route: ["HOD", "BU", "LND", "HR"] }).map((r) => r.stage)).toEqual([
      "You submit", "Department HOD", "Land BU Admin", "L&D Team", "HR Head",
    ]);
  });
  it("BU off, HR off: L&D gives the final approval", () => {
    const rows = routePanelRows({ ...who, route: ["HOD", "LND"] });
    expect(rows.map((r) => r.stage)).toEqual(["You submit", "Department HOD", "L&D Team"]);
    expect(rows.at(-1)!.who).toBe("Reviews and gives final approval");
  });
  it("flags a missing HOD or BU Admin", () => {
    const rows = routePanelRows({ ...who, hodName: null, buAdminNames: null, route: ["HOD", "BU", "LND"] });
    expect(rows[1].missing).toBe(true);
    expect(rows[2].missing).toBe(true);
  });
});
