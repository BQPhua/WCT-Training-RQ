"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Eye, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/misc";
import { BASE_PATH } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Nav, type NavProps } from "./nav";
import { DemoBanner, ViewAsBanner, ViewAsDialog, type DemoAccount } from "./view-as";
import { Wordmark } from "./wordmark";

export interface ShellUser {
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  roles: string[];
  /** System Admin (not currently viewing as someone): demo accounts they can view as. */
  demoAccounts?: DemoAccount[];
  /** Set while a System Admin is viewing as this demo user. */
  viewedAs?: { name: string; roleLabel: string } | null;
  /** Set when signed in directly with a demo account (sign-in page demo list). */
  demoSession?: { roleLabel: string } | null;
}

function UserMenu({ user, collapsed = false }: { user: ShellUser; collapsed?: boolean }) {
  const { setTheme, theme } = useTheme();
  // Kept outside the menu: the menu unmounts its items as soon as one is
  // selected, which would cancel a submit button placed inside it.
  const signOutForm = React.useRef<HTMLFormElement>(null);
  const [viewAsOpen, setViewAsOpen] = React.useState(false);
  return (
    <>
    <form ref={signOutForm} action={`${BASE_PATH}/api/auth/logout`} method="post" hidden />
    {user.demoAccounts && <ViewAsDialog open={viewAsOpen} onOpenChange={setViewAsOpen} accounts={user.demoAccounts} />}
    <Menu>
      <MenuTrigger
        aria-label={collapsed ? `${user.name} (account menu)` : undefined}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-shell-fg",
          collapsed && "justify-center",
        )}
      >
        <Avatar name={user.name} />
        <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
          <span className="block truncate text-sm font-medium text-shell-fg">{user.name}</span>
          <span className="block truncate text-xs text-shell-muted">{user.department ?? user.email}</span>
        </span>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-64">
        <MenuLabel>
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block truncate">{user.email}</span>
          {user.roles.length > 0 && <span className="mt-1 block text-info-text">{user.roles.join(" · ")}</span>}
        </MenuLabel>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        {[
          ["light", "Light", Sun],
          ["dark", "Dark", Moon],
          ["system", "System", Monitor],
        ].map(([value, label, Icon]) => {
          const I = Icon as typeof Sun;
          return (
            <MenuItem key={value as string} onSelect={() => setTheme(value as string)}>
              <I /> {label as string}
              {theme === value && <span className="ml-auto text-xs text-info-text">Active</span>}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        {user.demoAccounts && (
          <MenuItem onSelect={() => setViewAsOpen(true)}>
            <Eye /> View as demo user…
          </MenuItem>
        )}
        <MenuItem onSelect={() => signOutForm.current?.submit()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
    </>
  );
}

function SidebarBody({
  user,
  nav,
  onNavigate,
  instance,
  collapsed = false,
  onToggle,
}: {
  user: ShellUser;
  nav: NavProps;
  onNavigate?: () => void;
  instance: string;
  collapsed?: boolean;
  /** Desktop rail only: collapse or expand. */
  onToggle?: () => void;
}) {
  return (
    <div data-shell className="flex h-full flex-col bg-gradient-to-b from-shell via-shell to-shell-dusk">
      <div className={cn("pb-6 pt-5", collapsed ? "flex justify-center px-2" : "px-4")}>
        <Link href="/dashboard" onClick={onNavigate} aria-label={collapsed ? "Training RQ dashboard" : undefined} className="inline-block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-shell-fg">
          <Wordmark compact={collapsed} />
        </Link>
      </div>
      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", collapsed ? "px-2.5" : "px-3")}>
        <Nav {...nav} onNavigate={onNavigate} instance={instance} collapsed={collapsed} />
      </div>
      {onToggle && (
        <div className={cn("px-3 pb-2", collapsed && "flex justify-center px-2.5")}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-lg text-[13px] text-shell-muted transition-colors hover:bg-white/[0.06] hover:text-shell-fg focus-visible:outline-2 focus-visible:outline-shell-fg",
              collapsed ? "w-full justify-center" : "w-full px-3",
            )}
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      )}
      <div className="border-t border-white/10 p-3">
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </div>
  );
}

export function AppShell({
  user,
  nav,
  initialCollapsed = false,
  children,
}: {
  user: ShellUser;
  nav: NavProps;
  /** From the trq_sidebar cookie, so the first paint is already right. */
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `trq_sidebar=${next ? "collapsed" : "expanded"}; path=${BASE_PATH}; max-age=31536000; samesite=lax`;
  };
  return (
    <div className={cn("min-h-dvh transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
      {user.viewedAs && <ViewAsBanner name={user.viewedAs.name} roleLabel={user.viewedAs.roleLabel} />}
      {!user.viewedAs && user.demoSession && <DemoBanner name={user.name} roleLabel={user.demoSession.roleLabel} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden overflow-hidden bg-shell shadow-[inset_-1px_0_0_oklch(1_0_0/0.06)] transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <SidebarBody user={user} nav={nav} instance="rail" collapsed={collapsed} onToggle={toggle} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-gradient-to-r from-shell to-shell-dusk px-4 shadow-md lg:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="grid size-10 cursor-pointer place-items-center rounded-md text-shell-fg transition-colors hover:bg-white/10" aria-label="Open navigation">
              <MenuIcon className="size-5" />
            </button>
          </DialogTrigger>
          <SheetContent title="Navigation">
            <SidebarBody user={user} nav={nav} onNavigate={() => setOpen(false)} instance="drawer" />
          </SheetContent>
        </Dialog>
        <Link href="/dashboard" className="flex-1">
          <Wordmark />
        </Link>
        <Button asChild variant="brand" size="icon-sm" aria-label="New Training Requisition">
          <Link href="/requests/new">
            <Plus />
          </Link>
        </Button>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
