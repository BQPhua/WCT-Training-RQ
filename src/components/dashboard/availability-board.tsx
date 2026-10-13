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
  mine?: boolean;
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

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5" aria-label="Requests this year">
        {items.map((item, idx) => {
          const tone = toneOf(item.status);
          const dim = focus !== null && focus !== tone;
          const number = item.refNo ? item.refNo.slice(-4) : "—";
          return (
            <li key={item.id} style={{ animationDelay: `${Math.min(idx * 12, 600)}ms` }} className="animate-tile">
              <Tip
                content={
                  <span className="block space-y-0.5">
                    <span className="block font-semibold">{item.refNo ?? "Draft"}</span>
                    <span className="block">{item.title}</span>
                    <span className="block opacity-80">
                      {item.requesterName} · {STATUS_LABEL[item.status]}
                      {item.startDate ? ` · ${formatDateMY(item.startDate)}` : ""}
                    </span>
                  </span>
                }
              >
                <Link
                  href={`/requests/${item.id}`}
                  aria-label={`${item.refNo ?? "Draft"}: ${item.title}, ${STATUS_LABEL[item.status]}`}
                  className={cn(
                    "relative grid aspect-[5/4] place-items-center rounded-[5px] text-[11px] font-semibold tabular tracking-tight transition-[opacity,transform,filter] duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    TILE[tone],
                    dim && "opacity-20 saturate-0",
                    awaiting.has(item.id) && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                  )}
                >
                  {number}
                  {awaiting.has(item.id) && <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-brand ring-2 ring-surface" />}
                </Link>
              </Tip>
            </li>
          );
        })}
      </ol>
      {awaitingIds.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <span className="inline-block size-3 rounded-[3px] ring-2 ring-brand ring-offset-1 ring-offset-surface" aria-hidden />
          Ringed units are waiting for your action.
        </p>
      )}
    </div>
  );
}
