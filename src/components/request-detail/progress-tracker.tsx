import { Check, CornerUpLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeMY } from "@/lib/format";
import type { Status } from "@/lib/workflow";

export interface TrackerStation {
  key: string;
  label: string;
  state: "done" | "current" | "returned" | "upcoming" | "cancelled";
  who?: string;
  when?: Date | null;
}

/** A transit-line tracker: stations fill as the request moves along. */
export function ProgressTracker({ stations, status }: { stations: TrackerStation[]; status: Status }) {
  return (
    <ol className="grid grid-cols-1 gap-0 sm:grid-cols-5" aria-label="Approval progress">
      {stations.map((s, i) => {
        const last = i === stations.length - 1;
        const lineDone = s.state === "done" && stations[i + 1] && stations[i + 1].state !== "upcoming";
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 sm:flex-col sm:gap-2 sm:pb-0 sm:pr-3" aria-current={s.state === "current" ? "step" : undefined}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-[3px] rounded-full sm:left-7 sm:top-[13px] sm:h-[3px] sm:w-[calc(100%-1.75rem)]",
                  lineDone ? "bg-approved" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-[29px] shrink-0 place-items-center rounded-full border-[3px] bg-surface",
                s.state === "done" && "border-approved bg-approved text-white",
                s.state === "current" && "border-pending bg-pending-soft animate-pulse-ring",
                s.state === "returned" && "border-returned bg-returned text-white",
                s.state === "cancelled" && "border-cancelled bg-cancelled-soft text-cancelled-text",
                s.state === "upcoming" && "border-line-strong",
              )}
            >
              {s.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
              {s.state === "returned" && <CornerUpLeft className="size-3.5" strokeWidth={2.5} />}
              {s.state === "cancelled" && <X className="size-3.5" strokeWidth={3} />}
              {s.state === "current" && <span className="size-2 rounded-full bg-pending" />}
            </span>
            <span className="min-w-0 pt-0.5 sm:pt-0">
              <span className={cn("block text-sm font-medium", s.state === "upcoming" ? "text-muted" : "text-ink")}>{s.label}</span>
              {s.who && <span className="block truncate text-[13px] text-ink-2">{s.who}</span>}
              {s.when ? (
                <span className="block text-xs tabular text-muted">{formatDateTimeMY(s.when)}</span>
              ) : s.state === "current" ? (
                <span className="block text-xs font-medium text-pending-text">{status === "RETURNED" ? "Amend & resubmit" : "Waiting"}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
