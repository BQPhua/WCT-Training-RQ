"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, ...props }: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-shell/50 backdrop-blur-[2px] data-[state=open]:animate-[rise_200ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-lg outline-none data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      >
        <D.Title className="pr-8 text-lg font-semibold text-ink">{title}</D.Title>
        {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        <div className="mt-5">{children}</div>
        <D.Close className="absolute right-4 top-4 rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink cursor-pointer" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function SheetContent({ className, children, title, ...props }: React.ComponentProps<typeof D.Content> & { title: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-shell/50" />
      <D.Content className={cn("fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-shell shadow-lg outline-none data-[state=open]:animate-[rise_220ms_ease-out]", className)} {...props}>
        <D.Title className="sr-only">{title}</D.Title>
        <D.Description className="sr-only">{title}</D.Description>
        {children}
      </D.Content>
    </D.Portal>
  );
}
