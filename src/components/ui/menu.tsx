"use client";
import * as React from "react";
import { DropdownMenu as M, Tooltip as T } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

const OpenContext = React.createContext(false);

/** Radix DropdownMenu root that tracks its open state so the content can animate out. */
export function Menu({ open: openProp, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof M.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen ?? false);
  const open = openProp ?? uncontrolled;
  const change = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  return (
    <OpenContext.Provider value={open}>
      <M.Root open={open} onOpenChange={change} {...props} />
    </OpenContext.Provider>
  );
}
export const MenuTrigger = M.Trigger;
export function MenuContent({ className, children, ...props }: React.ComponentProps<typeof M.Content>) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <M.Portal forceMount>
          <M.Content forceMount asChild sideOffset={6} {...props}>
            <motion.div
              className={cn("z-50 min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-line bg-surface p-1 shadow-md outline-none", className)}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </M.Content>
        </M.Portal>
      )}
    </AnimatePresence>
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
          <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md bg-shell px-2.5 py-1.5 text-xs text-shell-fg shadow-md data-[state=delayed-open]:animate-rise dark:bg-surface-2 dark:text-ink dark:ring-1 dark:ring-line-strong">
            {content}
            <T.Arrow className="fill-shell dark:fill-surface-2" />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
