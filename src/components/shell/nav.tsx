"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FilePlus2, FolderClock, LayoutGrid, ListChecks, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavProps {
  approvals: number;
  isAdmin: boolean;
  onNavigate?: () => void;
}

export function Nav({ approvals, isAdmin, onNavigate }: NavProps) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/requests/new", label: "New Training Requisition", icon: FilePlus2 },
    { href: "/my-requests", label: "My requests", icon: ListChecks },
    { href: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: approvals },
    { href: "/history", label: "Training RQ History", icon: FolderClock },
    ...(isAdmin ? [{ href: "/admin", label: "Admin settings", icon: Settings2 }] : []),
  ];
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-shell-2 text-shell-fg" : "text-shell-muted hover:bg-shell-2/60 hover:text-shell-fg",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-shell-muted group-hover:text-shell-fg")} />
            <span className="truncate">{label}</span>
            {!!badge && (
              <span className="ml-auto min-w-6 rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-semibold text-brand-fg tabular">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
