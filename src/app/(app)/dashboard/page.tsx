import Link from "next/link";
import { ArrowRight, Inbox, Plus } from "lucide-react";
import {
  AnalyticsCharts,
  AnalyticsToolbar,
  analyticsYear,
} from "@/components/dashboard/analytics";
import { AvailabilityBoard } from "@/components/dashboard/availability-board";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import {
  formatDateMY,
  formatDateTimeMY,
  formatMYR,
  TIMEZONE,
} from "@/lib/format";
import { yearInMY } from "@/lib/format";
import { getDashboard } from "@/lib/services/dashboard";
import { canSeeReports, getReports } from "@/lib/services/reports";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const ACTION_TEXT: Record<string, string> = {
  SUBMIT: "submitted",
  RESUBMIT: "resubmitted",
  APPROVE: "approved",
  REJECT: "returned to the requester",
  CANCEL: "cancelled",
  EDIT_LND_FIELDS: "updated L&D details on",
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const user = await requireUser();
  const d = await getDashboard(user);
  const sp = await searchParams;
  const year = yearInMY();
  const aYear = analyticsYear(sp.year);
  const reports = canSeeReports(user)
    ? await getReports(user, { year: aYear })
    : null;
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Collapse consecutive steps on the same request into one feed row.
  const activity = d.recentActivity.reduce<
    ((typeof d.recentActivity)[number] & { earlier: number })[]
  >((acc, a) => {
    const last = acc[acc.length - 1];
    if (last && last.requestId === a.requestId) last.earlier += 1;
    else acc.push({ ...a, earlier: 0 });
    return acc;
  }, []);
  const monthShort = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  // One overview bar: personal counters first, then the year's figures. Analytics users
  // get the analytics totals for the selected year; others get their own approved totals.
  const kpis: {
    label: string;
    value: string;
    href: string;
    strong?: boolean;
  }[] = [
    {
      label: "Awaiting your action",
      value: String(d.awaitingMe),
      href: "/approvals",
      strong: d.awaitingMe > 0,
    },
    {
      label: "My open requests",
      value: String(d.myOpen),
      href: "/my-requests",
    },
    ...(reports
      ? [
          {
            label: `Requests submitted ${aYear}`,
            value: String(reports.totals.submitted),
            href: "/history",
          },
          {
            label: `Requests approved ${aYear}`,
            value: String(reports.totals.approved),
            href: "/history?status=APPROVED",
          },
          {
            label: `Approved training spend ${aYear}`,
            value: formatMYR(reports.totals.approvedFees),
            href: "/history?status=APPROVED",
          },
        ]
      : [
          {
            label: `Approved in ${year}`,
            value: String(d.approvedThisYear),
            href: "/history?status=APPROVED",
          },
          {
            label: `Approved spend ${year}`,
            value: formatMYR(d.feesThisYear),
            href: "/history?status=APPROVED",
          },
        ]),
  ];

  return (
    <div className="space-y-6">
      {sp.denied && (
        <p
          role="alert"
          className="rounded-lg bg-returned-soft px-4 py-3 text-sm text-returned-text"
        >
          You don&apos;t have access to that page.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">{today}</p>
        </div>
        <Button asChild variant="brand" size="lg">
          <Link href="/requests/new">
            <Plus /> New Training Requisition
          </Link>
        </Button>
      </div>

      <section
        id="analytics"
        aria-labelledby="overview-title"
        className="scroll-mt-6 space-y-6"
      >
        {reports && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="overview-title"
                className="text-lg font-semibold tracking-tight"
              >
                Overview &amp; analytics
              </h2>
              <p className="mt-0.5 text-sm text-muted">{`${reports.scopeLabel} · ${aYear}`}</p>
            </div>
            <AnalyticsToolbar year={aYear} />
          </div>
        )}
        {!reports && (
          <h2 id="overview-title" className="sr-only">
            Overview
          </h2>
        )}

        <Panel
          aria-label="Key figures"
          role="region"
          className={`grid grid-cols-2 gap-px overflow-hidden bg-line ${kpis.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
        >
          {kpis.map((p) => (
            <Link
              key={p.label}
              href={p.href}
              className={`group bg-surface px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5 ${kpis.length === 5 ? "last:col-span-2 lg:last:col-span-1" : ""}`}
            >
              <span className="block text-[12px] font-medium text-muted">
                {p.label}
              </span>
              <span
                className={`mt-1 flex items-baseline gap-2 whitespace-nowrap text-xl font-semibold tabular tracking-tight sm:text-2xl ${p.strong ? "text-brand-text" : "text-ink"}`}
              >
                {p.value}
                <ArrowRight className="size-4 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
            </Link>
          ))}
        </Panel>

        {reports && <AnalyticsCharts r={reports} year={aYear} />}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start [&>*]:min-w-0">
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Recent activity" />
            {activity.length ? (
              <ol className="divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                      <span className="font-medium text-ink">
                        {a.actorName}
                      </span>
                      <span className="text-muted">
                        {ACTION_TEXT[a.action] ?? a.action.toLowerCase()}
                      </span>
                      <Link
                        href={`/requests/${a.requestId}`}
                        className="min-w-0 truncate font-medium text-brand-text hover:underline"
                      >
                        {a.refNo} · {a.title}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs tabular text-muted">
                      {formatDateTimeMY(a.createdAt)}
                      {a.earlier > 0
                        ? ` · and ${a.earlier} earlier step${a.earlier > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No activity yet" />
            )}
          </Panel>
        </div>
        <div
          className={`space-y-6 ${d.awaitingMe > 0 ? "order-first xl:order-none" : ""}`}
        >
          <Panel className="flex flex-col">
            <PanelHeader
              title="Awaiting your action"
              actions={
                d.awaitingMe > 0 ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/approvals">View all</Link>
                  </Button>
                ) : null
              }
            />
            {d.awaitingList.length ? (
              <ul className="divide-y divide-line">
                {d.awaitingList.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold tabular text-muted">
                          {r.refNo}
                        </span>
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-ink">
                        {r.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {r.requesterName} · {r.departmentName} · starts{" "}
                        {formatDateMY(r.startDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Inbox />} title="You're all caught up">
                Nothing is waiting for you right now.
              </EmptyState>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Upcoming approved trainings" />
            {d.upcoming.length ? (
              <ul className="divide-y divide-line">
                {d.upcoming.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/requests/${u.id}`}
                      className="flex gap-3.5 px-5 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span className="grid w-11 shrink-0 place-items-center rounded-md border border-line bg-surface-2 py-1 text-center leading-none">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text">
                          {u.startDate ? monthShort(u.startDate) : "—"}
                        </span>
                        <span className="mt-0.5 text-lg font-semibold tabular text-ink">
                          {u.startDate?.slice(8, 10)}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {u.title}
                        </span>
                        <span className="block truncate text-[13px] text-muted">
                          {u.candidateCount} participant
                          {u.candidateCount === 1 ? "" : "s"} · {u.venue}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing scheduled">
                Approved trainings with upcoming dates appear here.
              </EmptyState>
            )}
          </Panel>
        </div>
      </div>

      <Panel aria-label="Availability board" role="region">
        <PanelHeader
          title={`Availability board · ${year}`}
          description="Every request you can see this year, one unit per request, one row per month. Select a unit to open it."
        />
        <PanelBody>
          {d.board.length ? (
            <AvailabilityBoard items={d.board} awaitingIds={d.awaitingIds} />
          ) : (
            <EmptyState title="No requests yet this year">
              Submitted training requests will appear here as units on the
              board.
            </EmptyState>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
