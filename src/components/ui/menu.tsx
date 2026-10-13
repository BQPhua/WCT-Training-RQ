"use client";
import * as React from "react";
import { DropdownMenu as M, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ className, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={6} className={cn("z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-md data-[state=open]:animate-rise", className)} {...props} />
    </M.Portal>
  );
}
export function MenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return <M.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-ink/5 [&_svg]:size-4 [&_svg]:text-muted", className)} {...props} />;
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
export function MenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...props} />;
}

export function Tip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md bg-shell px-2.5 py-1.5 text-xs text-shell-fg shadow-md data-[state=delayed-open]:animate-rise">
            {content}
            <T.Arrow className="fill-shell" />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
