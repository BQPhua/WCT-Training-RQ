"use client";
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-1 border-b border-line overflow-x-auto", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = T.Content;
