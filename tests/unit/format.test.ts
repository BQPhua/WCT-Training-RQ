import { describe, expect, it } from "vitest";
import { formatDateMY, formatDateTimeMY, formatMYR, formatRefNo, totalFees } from "@/lib/format";

describe("formatRefNo", () => {
  it("pads to 4 digits", () => {
    expect(formatRefNo(2026, 7)).toBe("TRQ-2026-0007");
    expect(formatRefNo(2026, 12345)).toBe("TRQ-2026-12345");
  });
});

describe("totalFees", () => {
  it("multiplies using integer cents", () => {
    expect(totalFees("1250.50", 3)).toBe("3751.50");
    expect(totalFees("0.10", 3)).toBe("0.30");
    expect(totalFees(null, 3)).toBe("0.00");
  });
});

describe("formatMYR", () => {
  it("formats with RM and thousands separators", () => {
    expect(formatMYR("3751.5")).toBe("RM 3,751.50");
    expect(formatMYR(0)).toBe("RM 0.00");
  });
});

describe("formatDateMY", () => {
  it("formats a YYYY-MM-DD string as dd/MM/yyyy", () => {
    expect(formatDateMY("2026-10-13")).toBe("13/10/2026");
  });
  it("formats a Date in Asia/Kuala_Lumpur", () => {
    // 2026-10-13T17:30Z is 14 Oct 01:30 in KL
    expect(formatDateMY(new Date("2026-10-13T17:30:00Z"))).toBe("14/10/2026");
  });
  it("returns an em dash for null", () => {
    expect(formatDateMY(null)).toBe("—");
  });
});

describe("formatDateTimeMY", () => {
  it("formats date and 12h time in KL", () => {
    expect(formatDateTimeMY(new Date("2026-10-13T01:05:00Z"))).toBe("13/10/2026, 9:05 AM");
  });
});

import { startOfYearMY, yearInMY } from "@/lib/format";

describe("Malaysia year boundaries", () => {
  it("1 Jan 01:00 MYT belongs to the new year even on a UTC server", () => {
    expect(yearInMY(new Date("2025-12-31T17:00:00Z"))).toBe(2026);
    expect(yearInMY(new Date("2025-12-31T15:59:00Z"))).toBe(2025);
  });
  it("year start is midnight in Kuala Lumpur", () => {
    expect(startOfYearMY(2026).toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });
});
