import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { BuAdminsEditor, BuDialog, DeptDialog } from "@/components/admin/org-editors";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { adminOverview } from "@/lib/services/admin";

export const metadata = { title: "Admin · Organisation" };

export default async function OrganisationPage() {
  const user = await requireUser();
  const o = await adminOverview(user);
  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Business units" description="BU Admins are informed when a HOD approves, on every rejection, on final approval and on cancellation." actions={<BuDialog />} />
        <ul className="divide-y divide-line">
          {o.bus.map((b) => (
            <li key={b.id} className="grid gap-3 px-5 py-4 md:grid-cols-[14rem_1fr] md:items-start">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-surface">{b.code}</span>
                <span className="font-medium">{b.name}</span>
                {!b.isActive && <span className="text-xs text-muted">(inactive)</span>}
                <BuDialog bu={b} />
                <Link href="/admin/flow" className="basis-full text-xs text-muted underline-offset-4 hover:text-info-text hover:underline">
                  Final approval: <span className="font-medium text-ink-2">{b.requiresHrApproval ? "HR Head" : "L&D Team"}</span> · change in Approval flow
                </Link>
              </div>
              <BuAdminsEditor buId={b.id} buName={b.name} current={o.buAdmins.filter((a) => a.businessUnitId === b.id).map((a) => ({ id: a.userId, name: a.name, email: "" }))} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Head of Departments" actions={<DeptDialog bus={o.bus} />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line bg-surface-2 text-xs text-muted">
              <tr>
                <th scope="col" className="px-5 py-2.5 text-left font-medium">Department</th>
                <th scope="col" className="px-5 py-2.5 text-left font-medium">Business unit</th>
                <th scope="col" className="px-5 py-2.5 text-left font-medium">HOD</th>
                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {o.depts.map((d) => (
                <tr key={d.id} className={d.isActive ? "" : "opacity-60"}>
                  <td className="px-5 py-2.5 font-medium">{d.name}{!d.isActive && <span className="ml-2 text-xs text-muted">inactive</span>}</td>
                  <td className="px-5 py-2.5 text-ink-2">{o.bus.find((b) => b.id === d.businessUnitId)?.name}</td>
                  <td className="px-5 py-2.5">
                    {d.hodName ?? (
                      <span className="inline-flex items-center gap-1.5 text-returned-text">
                        <CircleAlert className="size-4" /> Not assigned
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <DeptDialog dept={d} bus={o.bus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
