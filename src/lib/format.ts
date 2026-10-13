export const TIMEZONE = "Asia/Kuala_Lumpur";

export function formatRefNo(year: number, n: number): string {
  return `TRQ-${year}-${String(n).padStart(4, "0")}`;
}

function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const [whole, frac = ""] = String(value).split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const w = Math.abs(parseInt(whole || "0", 10));
  const f = parseInt((frac + "00").slice(0, 2), 10);
  return sign * (w * 100 + f);
}

function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Fee per pax × candidate count, exact to the cent. */
export function totalFees(feePerPax: string | number | null | undefined, count: number): string {
  return fromCents(toCents(feePerPax) * count);
}

export function formatMYR(value: string | number | null | undefined): string {
  const n = toCents(value) / 100;
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });

/** dd/MM/yyyy. Accepts a Date or a calendar 'YYYY-MM-DD' string (no TZ shift). */
export function formatDateMY(value: Date | string | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return dateFmt.format(new Date(value));
}

export function formatDateTimeMY(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** "09:00" → "9:00 AM" */
export function formatTime12(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return formatDateMY(start);
  return `${formatDateMY(start)} – ${formatDateMY(end)}`;
}

/** Calendar year in Malaysia (UTC+8, no DST), independent of the server's TZ. */
export function yearInMY(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, year: "numeric" }).format(d));
}

/** 00:00 on 1 January in Kuala Lumpur, as an absolute instant. */
export function startOfYearMY(year: number): Date {
  return new Date(Date.UTC(year, 0, 1) - 8 * 60 * 60 * 1000);
}
