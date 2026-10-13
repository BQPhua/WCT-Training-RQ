import { cn } from "@/lib/utils";

export const BU_SERIES: Record<string, string> = { LAND: "var(--series-1)", ENC: "var(--series-2)", MALLS: "var(--series-3)" };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Single-series vertical bars with a recessive grid and per-bar hover/focus tooltip. */
export function ColumnChart({
  data,
  format = (v) => String(v),
  label,
}: {
  data: { label: string; value: number; detail?: string }[];
  format?: (v: number) => string;
  label: string;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];
  return (
    <figure aria-label={label}>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative flex h-44 flex-col justify-between pb-0 text-right text-[11px] tabular text-muted">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{format(t)}</span>
          ))}
        </div>
        <div className="relative h-44">
          {ticks.map((t, i) => (
            <span key={t} aria-hidden className="absolute inset-x-0 h-px bg-[var(--grid)]" style={{ top: `${(i / 2) * 100}%` }} />
          ))}
          <ol className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d) => (
              <li key={d.label} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ""}`}>
                <span
                  className="w-full max-w-7 rounded-t-[4px] bg-[var(--series-1)] transition-opacity group-hover:opacity-80"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-shell px-2 py-1 text-xs text-shell-fg shadow-md group-hover:block group-focus-visible:block">
                  <span className="font-semibold">{d.label}</span> · {format(d.value)}
                  {d.detail ? <span className="block opacity-80">{d.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span />
        <div className="mt-1.5 flex gap-[2px] text-center text-[11px] text-muted">
          {data.map((d) => (
            <span key={d.label} className="flex-1">{d.label}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** Horizontal bars with direct labels; colour optional per row (categorical identity). */
export function BarList({
  rows,
  format = (v) => String(v),
}: {
  rows: { key: string; label: string; sub?: string; value: number; color?: string; valueLabel?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {r.color && <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />}
              <span className="truncate font-medium text-ink">{r.label}</span>
              {r.sub && <span className="truncate text-xs text-muted">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular text-ink-2">{r.valueLabel ?? format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--grid)]">
            <div className={cn("h-full rounded-full transition-[width] duration-700")} style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "var(--series-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
