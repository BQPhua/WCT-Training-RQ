"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncNowAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

export interface SyncSummary {
  configured: boolean;
  readOnly: boolean;
  last: { startedAt: string; ok: boolean | null; added: number; updated: number; flagged: number; error: string | null; trigger: string } | null;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Microsoft 365 sync status and the "Sync now" button (Admin settings → Users). */
export function SyncPanel({ configured, readOnly, last }: SyncSummary) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <section aria-label="Microsoft 365 sync" className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3 sm:px-6">
      <p className="min-w-0 text-[13px] text-ink-2">
        {readOnly && configured ? (
          <>Staff are synced from Microsoft 365 every night. Sync details are shown to real admins only.</>
        ) : !configured ? (
          <>Microsoft 365 sync is off. IT sets DIRECTORY_SEARCH_GRAPH=true and the ENTRA_* settings on the server to turn it on.</>
        ) : !last ? (
          <>Staff haven&apos;t been synced from Microsoft 365 yet. It runs every night at 1:40 AM, or use Sync now.</>
        ) : last.ok === null ? (
          <>A sync started at {when(last.startedAt)} is still running.</>
        ) : last.ok ? (
          <>
            Last synced {when(last.startedAt)} · {last.added} added, {last.updated} updated
            {last.flagged > 0 && <> · <span className="font-medium text-returned-text">{last.flagged} no longer in Microsoft 365</span></>}
          </>
        ) : (
          <span className="text-danger">Last sync on {when(last.startedAt)} failed: {last.error}</span>
        )}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={!configured || readOnly || busy}
        onClick={async () => {
          setBusy(true);
          const r = await syncNowAction();
          setBusy(false);
          if (r.ok) toast.success(r.summary);
          else toast.error(r.error);
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync now
      </Button>
    </section>
  );
}
