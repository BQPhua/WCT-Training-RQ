"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { SPRING } from "@/components/motion/fade-rise";
import { cn } from "@/lib/utils";

const TABS = [
  ["/admin/organisation", "Business units & departments"],
  ["/admin/roles", "Roles"],
  ["/admin/users", "Users"],
  ["/admin/notifications", "Notifications"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "relative inline-flex h-11 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors",
            pathname === href ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          {label}
          {pathname === href && <motion.span layoutId="admin-tab-underline" transition={SPRING} aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
        </Link>
      ))}
    </nav>
  );
}
