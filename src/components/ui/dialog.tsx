"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Open state shared with the content, so it can animate out before Radix unmounts it. */
const OpenContext = React.createContext(false);

/** Radix Dialog root that also tracks its open state (controlled or not) for exit animations. */
export function Dialog({ open: openProp, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof D.Root>) {
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
      <D.Root open={open} onOpenChange={change} {...props} />
    </OpenContext.Provider>
  );
}
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const FAST = { duration: 0.18, ease: [0.16, 1, 0.3, 1] } as const;

export function DialogContent({ className, children, title, description, ...props }: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <D.Portal forceMount>
          <D.Overlay forceMount asChild>
            <motion.div
              className="fixed inset-0 z-50 bg-shell/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FAST}
            />
          </D.Overlay>
          <D.Content forceMount asChild {...props}>
            <motion.div
              className={cn(
                "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(92vw,34rem)] overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-lg outline-none",
                className,
              )}
              style={{ x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={FAST}
            >
              <D.Title className="pr-8 text-lg font-semibold text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
              <div className="mt-5">{children}</div>
              <D.Close className="absolute right-4 top-4 cursor-pointer rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </D.Close>
            </motion.div>
          </D.Content>
        </D.Portal>
      )}
    </AnimatePresence>
  );
}

/** Left slide-over (the mobile navigation drawer). */
export function SheetContent({ className, children, title, ...props }: React.ComponentProps<typeof D.Content> & { title: string }) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <D.Portal forceMount>
          <D.Overlay forceMount asChild>
            <motion.div className="fixed inset-0 z-50 bg-shell/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FAST} />
          </D.Overlay>
          <D.Content forceMount asChild {...props}>
            <motion.div
              className={cn("fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-shell shadow-lg outline-none", className)}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", visualDuration: 0.28, bounce: 0 }}
            >
              <D.Title className="sr-only">{title}</D.Title>
              <D.Description className="sr-only">{title}</D.Description>
              {children}
            </motion.div>
          </D.Content>
        </D.Portal>
      )}
    </AnimatePresence>
  );
}
