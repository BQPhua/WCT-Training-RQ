import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { StatusBadge } from "@/components/status";
import { EmptyState } from "@/components/ui/misc";
import { formatDateRange, formatDateTimeMY, formatMYR } from "@/lib/format";
import type { HistoryFilters, HistoryRow } from "@/lib/services/history";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

function href(base: string, sp: SP, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

function SortHead({ label, col, f, base, sp, className }: { label: string; col: HistoryFilters["sort"]; f: HistoryFilters; base: string; sp: SP; className?: string }) {
  const active = f.sort === col;
  const nextDir = active && f.dir === "desc" ? "asc" : "desc";
  return (
    <th scope="col" aria-sort={active ? (f.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-2.5 text-left font-medium", className)}>
      <Link href={href(base, sp, { sort: col, dir: nextDir, page: undefined })} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        {active && (f.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </Link>
    </th>
  );
}

export function RequestsTable({ rows, total, f, base, sp, emptyTitle, emptyText }: { rows: HistoryRow[]; total: number; f: HistoryFilters; base: string; sp: SP; emptyTitle: string; emptyText?: string }) {
  const pages = Math.max(1, Math.ceil(total / f.pageSize));
  if (!rows.length) return <EmptyState icon={<SearchX />} title={emptyTitle}>{emptyText}</EmptyState>;
  return (
    <div>
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/requests/${r.id}`} className="block px-4 py-3.5 active:bg-surface-2">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tabular text-muted">{r.refNo ?? "Draft"}</span>
                <StatusBadge status={r.status} />
              </span>
              <span className="mt-1 block font-medium text-ink">{r.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {r.requesterName} · {formatDateRange(r.startDate, r.endDate)} · {formatMYR(r.totalFees)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs text-muted">
            <tr>
              <SortHead label="Ref no." col="refNo" f={f} base={base} sp={sp} className="w-36" />
              <SortHead label="Training" col="title" f={f} base={base} sp={sp} />
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Requester</th>
              <SortHead label="Dates" col="startDate" f={f} base={base} sp={sp} />
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Total fees</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Status</th>
              <SortHead label="Updated" col="updatedAt" f={f} base={base} sp={sp} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="group relative hover:bg-surface-2">
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular text-ink-2">
                  <Link href={`/requests/${r.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-focus">
                    {r.refNo ?? "Draft"}
                  </Link>
                </td>
                <td className="max-w-[22rem] px-4 py-3">
                  <span className="block truncate font-medium text-ink">{r.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.trainingType === "ADHOC" ? "Ad hoc" : r.trainingType === "PLANNED" ? "Planned" : "—"} · {r.candidateCount} candidate{r.candidateCount === 1 ? "" : "s"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="block text-ink">{r.requesterName}</span>
                  <span className="block truncate text-xs text-muted">{[r.departmentName, r.buName].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular text-ink-2">{formatDateRange(r.startDate, r.endDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular text-ink">{formatMYR(r.totalFees)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular text-muted">{formatDateTimeMY(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
        <span className="tabular">
          {(f.page - 1) * f.pageSize + 1}–{Math.min(f.page * f.pageSize, total)} of {total}
        </span>
        <span className="flex items-center gap-1">
          <Link
            aria-disabled={f.page <= 1}
            href={href(base, sp, { page: String(f.page - 1) })}
            className={cn("grid size-8 place-items-center rounded-md border border-line hover:bg-surface-2", f.page <= 1 && "pointer-events-none opacity-40")}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="px-2 tabular">
            Page {f.page} of {pages}
          </span>
          <Link
            aria-disabled={f.page >= pages}
            href={href(base, sp, { page: String(f.page + 1) })}
            className={cn("grid size-8 place-items-center rounded-md border border-line hover:bg-surface-2", f.page >= pages && "pointer-events-none opacity-40")}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Link>
        </span>
      </nav>
    </div>
  );
}
