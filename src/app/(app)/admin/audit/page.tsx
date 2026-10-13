import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTimeMY } from "@/lib/format";
import { listAudit } from "@/lib/services/admin";

export const metadata = { title: "Admin · Audit log" };

export default async function AuditPage() {
  const user = await requireUser();
  const rows = await listAudit(user);
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Audit log" description="Every change to settings, roles and users. Request decisions are recorded on each request's timeline." />
      {rows.length === 0 ? (
        <EmptyState title="No changes recorded yet" />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[11rem_10rem_1fr]">
              <span className="text-xs tabular text-muted">{formatDateTimeMY(a.createdAt)}</span>
              <span className="font-medium">{a.actorName}</span>
              <span className="min-w-0">
                <span className="mr-2 rounded bg-ground px-1.5 py-0.5 text-xs">{a.entity.replace(/_/g, " ")}</span>
                <code className="break-all font-mono text-xs text-ink-2">{JSON.stringify(a.change)}</code>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
