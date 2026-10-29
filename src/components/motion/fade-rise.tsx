import * as React from "react";
import { cn } from "@/lib/utils";

/** The one spring for layout motion (nav pill, tab underline): quick, no overshoot. */
export const SPRING = { type: "spring", visualDuration: 0.25, bounce: 0 } as const;

/**
 * Content arriving on screen: fade in and rise 6px.
 * A CSS animation, so content is visible without waiting for JavaScript, and the
 * global prefers-reduced-motion rule shortens it to nothing.
 */
export function FadeRise({
  delay = 0,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      className={cn("animate-rise", className)}
      style={delay ? { ...style, animationDelay: `${Math.round(delay * 1000)}ms` } : style}
      {...props}
    />
  );
}
