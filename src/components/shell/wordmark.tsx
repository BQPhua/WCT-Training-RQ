import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "./wct-logo.png";

/** WCT logo + product name. Static import keeps the URL basePath-aware. */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image src={logo} alt="WCT" unoptimized priority className="h-9 w-auto shrink-0" />
      {!compact && (
        <span className="border-l border-shell-line pl-3 leading-tight">
          <span className="block text-[13px] font-semibold text-shell-fg">Training RQ</span>
          <span className="block text-[11px] text-shell-muted">WCT HR Forms</span>
        </span>
      )}
    </span>
  );
}
