import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { BarList, BU_SERIES, ColumnChart } from "@/components/reports/charts";
import { YearSelect } from "@/components/reports/year-select";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { BASE_PATH } from "@/lib/env";
import { formatMYR } from "@/lib/format";
import { yearInMY } from "@/lib/format";
import { canSeeReports, getReports } from "@/lib/services/reports";
import { STAGE_LABEL, STATUSES } from "@/lib/workflow";

export const metadata = { title: "Reports" };

const compactRM = (v: number) => (v >= 1000 ? `RM ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `RM ${v.toFixed(0)}`);
const hours = (h: number | null) =>
  h === null ? "No decisions yet" : h < 1 ? (h * 60 < 1 ? "< 1 min" : `${Math.round(h * 60)} min`) : h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser();
  if (!canSeeReports(user)) redirect("/dashboard?denied=1");
  const sp = await searchParams;
  const now = yearInMY();
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= 2020 && y <= now + 1 ? y : now;
  const r = await getReports(user, { year });
  const years = Array.from({ length: now - 2023 }, (_, i) => now - i);
  const planned = r.byType.PLANNED + r.byType.ADHOC;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${r.scopeLabel} · ${year}`}
        actions={
          <>
            <YearSelect year={year} years={years} />
            <Button asChild variant="outline">
              <a href={`${BASE_PATH}/api/export/reports?year=${year}`}>
                <Download /> Export to Excel
              </a>
            </Button>
          </>
        }
      />

      <Panel className="mb-6 grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ["Requests submitted", String(r.totals.submitted)],
          ["Requests approved", String(r.totals.approved)],
          ["Approved training spend", formatMYR(r.totals.approvedFees)],
        ].map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <p className="text-[12px] font-medium text-muted">{k}</p>
            <p className="mt-1 text-2xl font-semibold tabular tracking-tight">{v}</p>
          </div>
        ))}
      </Panel>

      {r.totals.submitted === 0 ? (
        <Panel>
          <EmptyState title={`No submitted requests in ${year}`}>Reports fill in as requests are submitted and approved.</EmptyState>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Panel>
            <PanelHeader title="Requests submitted per month" />
            <PanelBody>
              <ColumnChart label="Requests submitted per month" data={r.byMonth.map((m) => ({ label: m.month, value: m.submitted, detail: `${m.approved} approved` }))} />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Approved spend per month" description="Fee per participant × candidates, by approval month" />
            <PanelBody>
              <ColumnChart label="Approved spend per month" format={compactRM} data={r.byMonth.map((m) => ({ label: m.month, value: Number(m.fees), detail: `${m.approved} approved` }))} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="By business unit" description="Approved spend" />
            <PanelBody>
              <BarList
                rows={r.byBU.map((b) => ({ key: b.code, label: b.name, sub: `${b.count} submitted · ${b.approved} approved`, value: Number(b.fees), color: BU_SERIES[b.code], valueLabel: formatMYR(b.fees) }))}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Time spent at each approval stage" description="Average from arrival at the stage to a decision" />
            <PanelBody>
              <BarList rows={r.turnaround.map((t) => ({ key: t.stage, label: STAGE_LABEL[t.stage], sub: `${t.decisions} decisions`, value: t.avgHours ?? 0, valueLabel: hours(t.avgHours) }))} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Planned vs ad hoc" />
            <PanelBody className="space-y-3">
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${r.byType.PLANNED} planned, ${r.byType.ADHOC} ad hoc`}>
                <span className="bg-[var(--series-1)]" style={{ flex: r.byType.PLANNED || 0.0001 }} />
                <span className="bg-[var(--series-3)]" style={{ flex: r.byType.ADHOC || 0.0001 }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-[3px] bg-[var(--series-1)]" /> Planned <b className="tabular">{r.byType.PLANNED}</b>
                  <span className="text-muted">({planned ? Math.round((r.byType.PLANNED / planned) * 100) : 0}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-[3px] bg-[var(--series-3)]" /> Ad hoc <b className="tabular">{r.byType.ADHOC}</b>
                </span>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Where requests stand" />
            <PanelBody>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STATUSES.filter((s) => s !== "DRAFT").map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <StatusBadge status={s} />
                    <span className="font-semibold tabular">{r.statusCounts[s]}</span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel className="overflow-hidden lg:col-span-2">
            <PanelHeader title="By department" description="Top departments by requests submitted" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Department</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Business unit</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Submitted</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Approved</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Approved spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.byDepartment.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 font-medium text-ink">{d.name}</td>
                      <td className="px-5 py-2.5 text-ink-2">{d.bu}</td>
                      <td className="px-5 py-2.5 text-right tabular">{d.n}</td>
                      <td className="px-5 py-2.5 text-right tabular">{d.approved}</td>
                      <td className="px-5 py-2.5 text-right tabular">{formatMYR(d.fees)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
