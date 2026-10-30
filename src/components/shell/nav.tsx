"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ClipboardCheck, FilePlus2, FolderClock, LayoutGrid, ListChecks, Settings2 } from "lucide-react";
import { SPRING } from "@/components/motion/fade-rise";
import { Tip } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export interface NavProps {
  approvals: number;
  isAdmin: boolean;
  onNavigate?: () => void;
  /** Distinguishes the desktop rail from the mobile drawer, so each has its own active pill. */
  instance?: string;
  /** Icon-only rail: labels become tooltips and the approvals count a red dot. */
  collapsed?: boolean;
}

export function Nav({ approvals, isAdmin, onNavigate, instance = "rail", collapsed = false }: NavProps) {
  const pathname = usePathname() ?? "";
  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/requests/new", label: "New Training Requisition", icon: FilePlus2 },
    { href: "/my-requests", label: "My requests", icon: ListChecks },
    { href: "/approvals", label: "Approvals", icon: ClipboardCheck, badge: approvals },
    { href: "/history", label: "Training RQ History", icon: FolderClock },
    ...(isAdmin ? [{ href: "/admin", label: "Admin settings", icon: Settings2 }] : []),
  ];
  return (
    <nav aria-label="Main" className="space-y-1">
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        const link = (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "px-3",
              active ? "text-shell-fg" : "text-shell-muted hover:bg-white/[0.06] hover:text-shell-fg",
            )}
          >
            {/* The active pill glides to the new item when you navigate. */}
            {active && (
              <motion.span
                layoutId={`nav-pill-${instance}`}
                transition={SPRING}
                aria-hidden
                className="absolute inset-0 rounded-lg bg-white/[0.09] shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] ring-1 ring-white/10"
              />
            )}
            <Icon className={cn("relative size-[18px] shrink-0", active ? "text-shell-accent" : "text-shell-muted group-hover:text-shell-fg")} />
            <span className={cn("relative truncate", collapsed && "sr-only")}>{label}</span>
            {!!badge &&
              (collapsed ? (
                <span role="img" aria-label={`${badge} awaiting your action`} className="absolute right-2.5 top-2 size-2 animate-beacon rounded-full bg-brand ring-2 ring-shell" />
              ) : (
                <span
                  aria-label={`${badge} awaiting your action`}
                  className="relative ml-auto min-w-6 animate-beacon rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-semibold text-brand-fg tabular"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              ))}
          </Link>
        );
        return collapsed ? (
          <Tip key={href} content={badge ? `${label} · ${badge} waiting` : label} side="right">
            {link}
          </Tip>
        ) : (
          link
        );
      })}
    </nav>
  );
}
