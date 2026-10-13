import Link from "next/link";
import { RetryButton } from "@/components/admin/user-editors";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import { formatDateTimeMY } from "@/lib/format";
import { listNotifications } from "@/lib/services/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await listNotifications(user);
  return (
    <div className="space-y-4">
      {!env.POWER_AUTOMATE_FLOW_URL && (
        <p role="alert" className="rounded-lg bg-returned-soft px-4 py-3 text-sm text-returned-text">
          POWER_AUTOMATE_FLOW_URL is not configured on the server, so notifications are being logged but not sent. See docs/POWER_AUTOMATE.md.
        </p>
      )}
      <Panel className="overflow-hidden">
        <PanelHeader title="Notification log" description="Every message sent to Power Automate. Failed ones retry automatically up to 3 times." />
        {rows.length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">When</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Request</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Event</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">To</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Retry</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((n) => {
                  const p = n.payload as { to?: string[]; cc?: string[] };
                  return (
                    <tr key={n.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs tabular text-muted">{formatDateTimeMY(n.createdAt)}</td>
                      <td className="px-5 py-2.5 font-medium tabular">{n.requestId ? <Link className="hover:underline" href={`/requests/${n.requestId}`}>{n.refNo ?? "Draft"}</Link> : "—"}</td>
                      <td className="px-5 py-2.5">{n.event.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="max-w-64 truncate px-5 py-2.5 text-xs text-ink-2" title={[...(p.to ?? []), ...(p.cc ?? [])].join(", ")}>
                        {(p.to ?? []).join(", ")}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", n.status === "SENT" ? "bg-approved-soft text-approved-text" : n.status === "FAILED" ? "bg-returned-soft text-returned-text" : "bg-pending-soft text-pending-text")}>
                          {n.status.toLowerCase()} · {n.attempts}
                        </span>
                        {n.lastError && <span className="mt-1 block max-w-56 truncate text-xs text-muted" title={n.lastError}>{n.lastError}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right">{n.status !== "SENT" && <RetryButton id={n.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
