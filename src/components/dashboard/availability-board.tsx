"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DOT, toneOf, type Tone } from "@/components/status";
import { Tip } from "@/components/ui/menu";
import { STATUS_LABEL, type Status } from "@/lib/workflow";
import { formatDateMY } from "@/lib/format";

export interface BoardItem {
  id: string;
  refNo: string | null;
  title: string;
  status: Status;
  startDate: string | null;
  requesterName: string;
  submittedAt: Date | string | null;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", month: "short" });
const MONTH_NUM = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", month: "numeric" });

/** Floors of the chart: one row per submission month, latest on top. */
function byMonth(items: BoardItem[]) {
  const rows = new Map<number, { label: string; items: BoardItem[] }>();
  for (const it of items) {
    const d = it.submittedAt ? new Date(it.submittedAt) : null;
    const m = d ? Number(MONTH_NUM.format(d)) : 0;
    if (!rows.has(m)) rows.set(m, { label: d ? MONTH_FMT.format(d).toUpperCase() : "—", items: [] });
    rows.get(m)!.items.push(it);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v);
}

const TILE: Record<Tone, string> = {
  approved: "bg-approved text-white",
  pending: "bg-pending text-[oklch(0.3_0.06_70)]",
  returned: "bg-returned text-white",
  cancelled: "bg-cancelled-soft text-cancelled-text ring-1 ring-inset ring-cancelled/40 [background-image:repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklch,var(--st-cancelled)_22%,transparent)_5px_6px)]",
  draft: "bg-draft text-draft-text",
};

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "pending", label: "In approval" },
  { tone: "returned", label: "Returned" },
  { tone: "approved", label: "Approved" },
  { tone: "cancelled", label: "Cancelled" },
];

/**
 * The signature element: every request this year as a unit on a sales-gallery
 * availability chart. Colour = where it stands; label = its running number.
 */
export function AvailabilityBoard({ items, awaitingIds }: { items: BoardItem[]; awaitingIds: string[] }) {
  const [focus, setFocus] = useState<Tone | null>(null);
  const counts = items.reduce<Record<Tone, number>>(
    (acc, i) => ((acc[toneOf(i.status)] += 1), acc),
    { approved: 0, pending: 0, returned: 0, cancelled: 0, draft: 0 },
  );
  const awaiting = new Set(awaitingIds);

  return (
    <div>
      <div role="group" aria-label="Filter board by status" className="mb-4 flex flex-wrap gap-1.5">
        {LEGEND.map(({ tone, label }) => (
          <button
            key={tone}
            type="button"
            aria-pressed={focus === tone}
            onClick={() => setFocus((f) => (f === tone ? null : tone))}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors",
              focus === tone ? "border-ink bg-ink text-ground" : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            <span className={cn("size-2.5 rounded-[3px]", DOT[tone])} aria-hidden />
            {label}
            <span className="tabular font-semibold">{counts[tone]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5" aria-label="Requests this year by submission month">
        {byMonth(items).map((row, r) => (
          <div key={row.label} className="flex items-stretch gap-2">
            <span className="w-11 shrink-0 self-center text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{row.label}</span>
            <ol className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5 border-l border-line pl-2">
              {row.items.map((item, idx) => {
                const tone = toneOf(item.status);
                const dim = focus !== null && focus !== tone;
                const number = item.refNo ? item.refNo.slice(-4) : "—";
                return (
                  <li key={item.id} style={{ animationDelay: `${Math.min(r * 60 + idx * 14, 700)}ms` }} className="animate-tile">
                    <Tip
                      content={
                        <span className="block space-y-0.5">
                          <span className="block font-semibold">{item.refNo ?? "Draft"}</span>
                          <span className="block">{item.title}</span>
                          <span className="block opacity-80">
                            {item.requesterName} · {STATUS_LABEL[item.status]}
                            {item.startDate ? ` · starts ${formatDateMY(item.startDate)}` : ""}
                          </span>
                        </span>
                      }
                    >
                      <Link
                        href={`/requests/${item.id}`}
                        aria-label={`${item.refNo ?? "Draft"}: ${item.title}, ${STATUS_LABEL[item.status]}${awaiting.has(item.id) ? ", waiting for you" : ""}`}
                        className={cn(
                          "relative grid aspect-[5/4] place-items-center rounded-[5px] text-[11px] font-semibold tabular tracking-tight transition-[opacity,transform,filter] duration-200 hover:-translate-y-0.5 hover:shadow-md",
                          TILE[tone],
                          dim && "opacity-20 saturate-0",
                          awaiting.has(item.id) && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                        )}
                      >
                        {number}
                      </Link>
                    </Tip>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      {awaitingIds.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <span className="inline-block size-3 rounded-[3px] ring-2 ring-brand ring-offset-1 ring-offset-surface" aria-hidden />
          Ringed units are waiting for your action.
        </p>
      )}
    </div>
  );
}
