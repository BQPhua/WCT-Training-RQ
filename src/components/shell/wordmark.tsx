import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "./wct-logo.png";

/** WCT logo + product name. Static import keeps the URL basePath-aware. */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      {/* White chip keeps the logo's grey road visible on the dark navigation shell. */}
      <span className="shrink-0 rounded-md bg-white px-1.5 py-1 shadow-sm">
        <Image src={logo} alt="WCT" unoptimized priority className="h-7 w-auto" />
      </span>
      {!compact && (
        <span className="border-l border-shell-line pl-3 leading-tight">
          <span className="block text-[13px] font-semibold text-shell-fg">Training RQ</span>
          <span className="block text-[11px] text-shell-muted">WCT HR Forms</span>
        </span>
      )}
    </span>
  );
}
