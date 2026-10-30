import { Search } from "lucide-react";
import { AddUserDialog, UserActiveToggle, UserDeptSelect } from "@/components/admin/user-editors";
import { Input } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTimeMY } from "@/lib/format";
import { listUsers, type UserStatusFilter } from "@/lib/services/admin";
import { directoryConfigFromEnv, lastSyncRun } from "@/lib/services/directory-sync";
import { SyncPanel } from "@/components/admin/sync-panel";
import { StatusSelect } from "@/components/admin/status-select";
import { isDemoUser } from "@/lib/auth/roles";
import { orgOptions } from "@/lib/services/org";

export const metadata = { title: "Admin · Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status: UserStatusFilter = ["signed-in", "not-signed-in", "left"].includes(String(sp.status)) ? (sp.status as UserStatusFilter) : "all";
  const [rows, org, last] = await Promise.all([listUsers(user, q, status), orgOptions(), lastSyncRun()]);
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Users"
        description="Staff are copied from Microsoft 365 every night (and on first sign-in). Fix unmatched departments here."
        actions={<AddUserDialog depts={org.departments} />}
      />
      <SyncPanel
        configured={directoryConfigFromEnv() !== null}
        readOnly={isDemoUser(user)}
        last={isDemoUser(user) || !last ? null : { startedAt: last.startedAt.toISOString(), ok: last.ok, added: last.added, updated: last.updated, flagged: last.flagged, error: last.error, trigger: last.trigger }}
      />
      <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 sm:px-6">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search name or email…" aria-label="Search users" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          Show
          <StatusSelect value={status} />
        </label>
        {rows.length === 200 && <span className="text-xs text-muted">Showing the first 200. Search to narrow the list.</span>}
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Name</th>
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Department</th>
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Microsoft 365 department</th>
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Last sign-in</th>
              <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-55"}>
                <td className="px-5 py-2.5">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {u.name}
                    {u.leftDirectory && <span className="rounded bg-returned-soft px-1.5 py-0.5 text-[11px] font-medium text-returned-text">No longer in Microsoft 365</span>}
                  </span>
                  <span className="block text-xs text-muted">{u.email}</span>
                </td>
                <td className="w-64 px-5 py-2.5">
                  <UserDeptSelect userId={u.id} value={u.departmentId} depts={org.departments} />
                </td>
                <td className="px-5 py-2.5 text-ink-2">
                  {u.entraDepartment ?? "—"}
                  {u.entraDepartment && !u.departmentId && <span className="ml-2 rounded bg-returned-soft px-1.5 py-0.5 text-[11px] text-returned-text">Unmatched</span>}
                </td>
                <td className="px-5 py-2.5 text-xs tabular text-muted">
                  {u.lastLoginAt ? formatDateTimeMY(u.lastLoginAt) : <span className="rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info-text">Not signed in yet</span>}
                </td>
                <td className="px-5 py-2.5 text-right">
                  {u.id !== user.id && <UserActiveToggle userId={u.id} active={u.isActive} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
