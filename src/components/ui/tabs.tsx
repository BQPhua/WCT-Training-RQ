"use client";
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { motion } from "motion/react";
import { SPRING } from "@/components/motion/fade-rise";
import { cn } from "@/lib/utils";

/** The active value and a per-instance id, so each tab set has its own underline. */
const TabsContext = React.createContext<{ value: string | undefined; id: string }>({ value: undefined, id: "" });

export function Tabs({ value: valueProp, defaultValue, onValueChange, ...props }: React.ComponentProps<typeof T.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const value = valueProp ?? uncontrolled;
  const id = React.useId();
  return (
    <TabsContext.Provider value={{ value, id }}>
      <T.Root
        value={value}
        onValueChange={(v) => {
          if (valueProp === undefined) setUncontrolled(v);
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, children, value, ...props }: React.ComponentProps<typeof T.Trigger>) {
  const ctx = React.useContext(TabsContext);
  return (
    <T.Trigger
      value={value}
      className={cn(
        "relative inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap px-3 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {ctx.value === value && <motion.span layoutId={`tab-underline-${ctx.id}`} transition={SPRING} aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
    </T.Trigger>
  );
}

export const TabsContent = T.Content;
