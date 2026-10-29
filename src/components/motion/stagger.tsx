import * as React from "react";
import { cn } from "@/lib/utils";

const STEP_MS = 30;

type ItemProps = React.ComponentProps<"li"> & { as?: "li" | "div" | "tr"; index?: number; limit?: number };

/** One row of a Stagger. Rows past the limit render plainly. */
export function StaggerItem({ as: Tag = "li", index = Number.POSITIVE_INFINITY, limit = 8, className, style, ...props }: ItemProps) {
  const animated = index < limit;
  return React.createElement(Tag, {
    className: cn(animated && "animate-rise", className),
    style: animated && index > 0 ? { ...style, animationDelay: `${index * STEP_MS}ms` } : style,
    ...props,
  });
}

/**
 * A short list whose first rows arrive one after another (30ms apart, first `limit` only),
 * so a long list is never held back. CSS-driven, like FadeRise.
 */
export function Stagger({
  as: Tag = "div",
  limit = 8,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "ul" | "ol" | "div" | "tbody"; limit?: number }) {
  let i = 0;
  const items = React.Children.map(children, (child) =>
    React.isValidElement<ItemProps>(child) && child.type === StaggerItem ? React.cloneElement(child, { index: i++, limit }) : child,
  );
  return React.createElement(Tag, props, items);
}
