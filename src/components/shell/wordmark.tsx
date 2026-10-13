import { cn } from "@/lib/utils";

/** Placeholder wordmark until WCT supplies its official logo (swap this component). */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className="grid size-8 place-items-center rounded-md bg-brand text-[13px] font-bold tracking-tight text-brand-fg">
        WCT
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-shell-fg">Training RQ</span>
          <span className="block text-[11px] text-shell-muted">WCT HR Forms</span>
        </span>
      )}
    </span>
  );
}
