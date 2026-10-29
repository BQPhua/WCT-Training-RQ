import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "field-control w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] sm:text-sm text-ink shadow-[inset_0_1px_1px_oklch(0.22_0.045_268/0.04)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted hover:border-ink-2/40 focus-visible:border-focus focus-visible:ring-[3px] focus-visible:ring-focus/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 resize-y [field-sizing:content] max-h-80", className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-10 appearance-none pr-9 cursor-pointer", className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Sentence-case field label. */
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("block text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
