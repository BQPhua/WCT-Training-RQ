import * as React from "react";
import { cn } from "@/lib/utils";

/** A work surface. Use sparingly; never nest panels. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-line bg-surface shadow-sm", className)} {...props} />;
}

export function PanelHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4 sm:px-6", className)} {...props} />;
}
