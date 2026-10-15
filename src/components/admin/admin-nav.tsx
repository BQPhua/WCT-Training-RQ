"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
            "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
            pathname === href ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
