import Link from "next/link";
import { ArrowRight, Inbox, Plus } from "lucide-react";
import { AvailabilityBoard } from "@/components/dashboard/availability-board";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateMY, formatDateTimeMY, formatMYR, TIMEZONE } from "@/lib/format";
import { yearInMY } from "@/lib/format";
import { getDashboard } from "@/lib/services/dashboard";
import { STAGE_LABEL, type Stage } from "@/lib/workflow";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const ACTION_TEXT: Record<string, string> = {
  SUBMIT: "submitted",
  RESUBMIT: "resubmitted",
  APPROVE: "approved",
  REJECT: "sent back",
  CANCEL: "cancelled",
  EDIT_LND_FIELDS: "updated L&D details on",
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const d = await getDashboard(user);
  const sp = await searchParams;
  const year = yearInMY();
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const placards = [
    { label: "Awaiting your action", value: String(d.awaitingMe), href: "/approvals", strong: d.awaitingMe > 0 },
    { label: "My open requests", value: String(d.myOpen), href: "/my-requests" },
    { label: `Approved in ${year}`, value: String(d.approvedThisYear), href: `/history?status=APPROVED` },
    { label: `Approved spend ${year}`, value: formatMYR(d.feesThisYear), href: "/reports" },
  ];

  return (
    <div className="space-y-6">
      {sp.denied && (
        <p role="alert" className="rounded-lg bg-returned-soft px-4 py-3 text-sm text-returned-text">
          You don&apos;t have access to that page.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <Button asChild variant="brand" size="lg">
          <Link href="/requests/new">
            <Plus /> New training request
          </Link>
        </Button>
      </div>

      <Panel className="grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {placards.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="group border-line px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+2)]:border-l lg:[&:nth-child(n+3)]:border-t-0"
          >
            <span className="block text-[12px] font-medium text-muted">{p.label}</span>
            <span className={`mt-1 flex items-baseline gap-2 whitespace-nowrap text-xl font-semibold tabular tracking-tight sm:text-2xl ${p.strong ? "text-brand-text" : "text-ink"}`}>
              {p.value}
              <ArrowRight className="size-4 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
          </Link>
        ))}
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start [&>*]:min-w-0">
        <Panel>
          <PanelHeader
            title={`Availability board · ${year}`}
            description="Every request you can see this year, one unit each. Hover for details, click to open."
          />
          <PanelBody>
            {d.board.length ? (
              <AvailabilityBoard items={d.board} awaitingIds={d.awaitingIds} />
            ) : (
              <EmptyState title="No requests yet this year">Submitted training requests will appear here as units on the board.</EmptyState>
            )}
          </PanelBody>
        </Panel>

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
                  <Link href={`/requests/${r.id}`} className="block px-5 py-3.5 transition-colors hover:bg-surface-2">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tabular text-muted">{r.refNo}</span>
                      <StatusBadge status={r.status} />
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium text-ink">{r.title}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {r.requesterName} · {r.departmentName} · starts {formatDateMY(r.startDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Inbox />} title="You're all caught up">Nothing is waiting for you right now.</EmptyState>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Recent activity" />
        {d.recentActivity.length ? (
          <ol className="divide-y divide-line">
            {d.recentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3 text-sm">
                <span className="font-medium text-ink">{a.actorName}</span>
                <span className="text-muted">
                  {ACTION_TEXT[a.action] ?? a.action.toLowerCase()}
                  {a.action === "REJECT" && a.sentBackTo ? ` to ${STAGE_LABEL[a.sentBackTo as Stage]}` : ""}
                </span>
                <Link href={`/requests/${a.requestId}`} className="min-w-0 truncate font-medium text-brand-text hover:underline">
                  {a.refNo} · {a.title}
                </Link>
                <span className="ml-auto text-xs tabular text-muted">{formatDateTimeMY(a.createdAt)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No activity yet" />
        )}
      </Panel>
    </div>
  );
}
