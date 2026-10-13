import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand: "bg-brand text-brand-fg shadow-sm hover:bg-brand-hover font-semibold",
        primary: "bg-shell text-shell-fg shadow-sm hover:bg-shell-2 dark:bg-ink dark:text-ground dark:hover:bg-ink-2",
        outline: "border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-2 hover:border-ink-2/40",
        ghost: "text-ink-2 hover:bg-ink/5 hover:text-ink",
        approve: "bg-approved text-white shadow-sm hover:brightness-95 font-semibold",
        danger: "bg-danger text-white shadow-sm hover:brightness-95 font-semibold",
        link: "text-brand-text underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
