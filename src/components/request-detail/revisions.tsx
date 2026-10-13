import { formatDateTimeMY, formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Snapshot = Record<string, unknown> & { candidates?: { name: string }[] };

const FIELDS: [string, string][] = [
  ["trainingType", "Type"],
  ["title", "Title"],
  ["objective", "Objective"],
  ["startDate", "Start date"],
  ["endDate", "End date"],
  ["startTime", "Start time"],
  ["endTime", "End time"],
  ["feePerPax", "Fee per pax"],
  ["venue", "Venue"],
  ["conductedBy", "Conducted by"],
  ["candidates", "Candidates"],
];

function show(key: string, s: Snapshot): string {
  const v = s[key];
  if (key === "candidates") return (s.candidates ?? []).map((c) => c.name).join(", ");
  if (key === "feePerPax") return formatMYR(v as string);
  if (key === "trainingType") return v === "PLANNED" ? "Planned" : v === "ADHOC" ? "Ad hoc" : "—";
  return (v as string) || "—";
}

/** Each submitted version, with fields changed since the previous version highlighted. */
export function Revisions({ revisions }: { revisions: { id: string; revisionNo: number; snapshot: Snapshot; createdAt: Date }[] }) {
  if (!revisions.length) return <p className="text-sm text-muted">No submitted versions yet.</p>;
  const asc = [...revisions].sort((a, b) => a.revisionNo - b.revisionNo);
  return (
    <div className="space-y-3">
      {[...asc].reverse().map((rev) => {
        const prev = asc.find((r) => r.revisionNo === rev.revisionNo - 1);
        const changed = prev ? FIELDS.filter(([k]) => show(k, rev.snapshot) !== show(k, prev.snapshot)) : [];
        return (
          <details key={rev.id} className="group rounded-lg border border-line" open={rev.revisionNo === asc.length && asc.length > 1}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2">
              <span className="text-sm font-semibold text-ink">Version {rev.revisionNo}</span>
              <span className="text-xs tabular text-muted">{formatDateTimeMY(rev.createdAt)}</span>
              {prev && (
                <span className="text-xs text-brand-text">
                  {changed.length ? `${changed.length} field${changed.length > 1 ? "s" : ""} changed` : "No content changes"}
                </span>
              )}
            </summary>
            <dl className="grid gap-x-4 border-t border-line px-4 py-3 text-sm sm:grid-cols-[140px_1fr]">
              {FIELDS.map(([k, label]) => {
                const isChanged = changed.some(([c]) => c === k);
                return (
                  <div key={k} className="contents">
                    <dt className="py-1 text-muted">{label}</dt>
                    <dd className={cn("py-1 text-ink", isChanged && "rounded bg-brand-soft px-1.5")}>
                      {show(k, rev.snapshot)}
                      {isChanged && prev && <span className="ml-2 text-xs text-muted line-through">{show(k, prev.snapshot)}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </details>
        );
      })}
    </div>
  );
}
