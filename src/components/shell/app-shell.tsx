"use client";
import * as React from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/misc";
import { BASE_PATH } from "@/lib/env";
import { Nav, type NavProps } from "./nav";
import { Wordmark } from "./wordmark";

export interface ShellUser {
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  roles: string[];
}

function UserMenu({ user }: { user: ShellUser }) {
  const { setTheme, theme } = useTheme();
  // Kept outside the menu: the menu unmounts its items as soon as one is
  // selected, which would cancel a submit button placed inside it.
  const signOutForm = React.useRef<HTMLFormElement>(null);
  return (
    <>
    <form ref={signOutForm} action={`${BASE_PATH}/api/auth/logout`} method="post" hidden />
    <Menu>
      <MenuTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-shell-2/60 outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <Avatar name={user.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-shell-fg">{user.name}</span>
          <span className="block truncate text-xs text-shell-muted">{user.department ?? user.email}</span>
        </span>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-64">
        <MenuLabel>
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block truncate">{user.email}</span>
          {user.roles.length > 0 && <span className="mt-1 block text-brand-text">{user.roles.join(" · ")}</span>}
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
              {theme === value && <span className="ml-auto text-xs text-brand-text">Active</span>}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem onSelect={() => signOutForm.current?.submit()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
    </>
  );
}

function SidebarBody({ user, nav, onNavigate }: { user: ShellUser; nav: NavProps; onNavigate?: () => void }) {
  return (
    <div data-shell className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link href="/dashboard" onClick={onNavigate} className="inline-block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Wordmark />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <Nav {...nav} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-shell-line p-3">
        <UserMenu user={user} />
      </div>
    </div>
  );
}

export function AppShell({ user, nav, children }: { user: ShellUser; nav: NavProps; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-shell lg:block">
        <SidebarBody user={user} nav={nav} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-shell-line bg-shell px-4 lg:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="grid size-10 cursor-pointer place-items-center rounded-md text-shell-fg hover:bg-shell-2" aria-label="Open navigation">
              <MenuIcon className="size-5" />
            </button>
          </Dialog.Trigger>
          <SheetContent title="Navigation">
            <SidebarBody user={user} nav={nav} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Dialog.Root>
        <Link href="/dashboard" className="flex-1">
          <Wordmark />
        </Link>
        <Button asChild variant="brand" size="icon-sm" aria-label="New request">
          <Link href="/requests/new">
            <Plus />
          </Link>
        </Button>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
