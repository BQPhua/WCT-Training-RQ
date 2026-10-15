"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/misc";
import { BASE_PATH } from "@/lib/env";

export interface DemoAccount {
  id: string;
  name: string;
  roleLabel: string;
}

async function post(body: object): Promise<boolean> {
  const res = await fetch(`${BASE_PATH}/api/auth/view-as`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return true;
  toast.error((await res.json().catch(() => null))?.error ?? "Couldn't switch user.");
  return false;
}

/** System Admin: pick a demo account to see the app as that role. */
export function ViewAsDialog({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: DemoAccount[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function pick(a: DemoAccount) {
    setBusy(a.id);
    if (await post({ userId: a.id })) {
      onOpenChange(false);
      setBusy(null);
      router.push("/dashboard");
      router.refresh();
    } else setBusy(null);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="View as demo user" description="See the system exactly as each role does. Anything you do is recorded as that demo user. Only @demo.wct.my accounts are listed.">
        {accounts.length ? (
          <ul className="-mx-2 max-h-[60vh] divide-y divide-line overflow-y-auto">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => pick(a)}
                  disabled={!!busy}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                >
                  <Avatar name={a.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                    <span className="block truncate text-xs text-muted">{a.roleLabel}</span>
                  </span>
                  {busy === a.id ? <Loader2 className="size-4 animate-spin text-muted" /> : <Eye className="size-4 text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No demo accounts. Load the sample data first (demo-data.sh load).</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Shown on every page while a System Admin is viewing as a demo account. */
export function ViewAsBanner({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function exit() {
    setBusy(true);
    if (await post({ stop: true })) {
      router.push("/dashboard");
      router.refresh();
    }
    setBusy(false);
  }
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand px-4 py-2 text-sm text-brand-fg lg:top-0">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span>
        Viewing as <b className="font-semibold">{name}</b> ({roleLabel})
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-fg/10 px-2.5 py-1 font-medium hover:bg-brand-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />} Exit
      </button>
    </div>
  );
}

/** Shown to everyone signed in with a demo account from the sign-in page. */
export function DemoBanner({ name, roleLabel }: { name: string; roleLabel: string }) {
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand px-4 py-2 text-sm text-brand-fg">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span>
        Demo account: <b className="font-semibold">{name}</b> ({roleLabel}). You&apos;re seeing demo requests only.
      </span>
      <form action={`${BASE_PATH}/api/auth/logout`} method="post">
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-fg/10 px-2.5 py-1 font-medium hover:bg-brand-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg"
        >
          <LogOut className="size-3.5" /> Switch account
        </button>
      </form>
    </div>
  );
}
