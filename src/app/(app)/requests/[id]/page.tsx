import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, FileText, MapPin, Pencil, Printer, Presentation, Wallet } from "lucide-react";
import { db } from "@/db";
import { ActionPanel } from "@/components/request-detail/action-panel";
import { CloneButton } from "@/components/request-detail/clone-button";
import { Comments } from "@/components/request-detail/comments";
import { LndFieldsForm } from "@/components/request-detail/lnd-fields";
import { ProgressTracker } from "@/components/request-detail/progress-tracker";
import { Revisions } from "@/components/request-detail/revisions";
import { Timeline } from "@/components/request-detail/timeline";
import { formatBytes } from "@/components/request-form/attachment-field";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth/current-user";
import { BASE_PATH } from "@/lib/env";
import { formatDateRange, formatDateTimeMY, formatMYR, formatTime12, totalFees } from "@/lib/format";
import { hrHeadNames } from "@/lib/services/parties";
import { getRequestForUser } from "@/lib/services/requests";
import { buildStations } from "@/lib/services/tracker";
import { canComment, canEditContent, canEditLndFields, getAllowedActions, STAGE_LABEL, stageOf } from "@/lib/workflow";

export async function generateMetadata({ params }: PageProps<"/requests/[id]">) {
  return { title: `Request ${(await params).id.slice(0, 8)}` };
}

function Fact({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-sm font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

export default async function RequestDetailPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getRequestForUser(user, id);
  if (!d) notFound();

  const r = d.request;
  const actions = getAllowedActions(r, user.actor, d.counts);
  const stations = buildStations(d, { hod: d.department?.hod?.name ?? null, hr: await hrHeadNames(db) });
  const stage = stageOf(r.status);
  const total = totalFees(r.feePerPax, d.candidates.length);
  const showLnd = r.status !== "DRAFT";

  return (
    <div className="space-y-6">
      {sp.submitted && (
        <p role="status" className="animate-rise rounded-lg bg-approved-soft px-4 py-3 text-sm text-approved-text">
          Submitted. {d.department?.hod?.name ?? "Your HOD"} has been notified and the request is now on the board.
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 animate-rise">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md bg-shell px-2 py-0.5 text-[13px] font-semibold tabular tracking-tight text-shell-fg">{r.refNo ?? "Draft"}</span>
            <StatusBadge status={r.status} />
            <span className="text-[13px] text-muted">{r.trainingType === "PLANNED" ? "Planned training" : r.trainingType === "ADHOC" ? "Ad hoc training" : ""}</span>
          </div>
          <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight sm:text-[28px]">{r.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {d.requester.name} · {d.department?.name ?? "No department"}
            {d.businessUnit ? ` · ${d.businessUnit.name}` : ""}
            {r.submittedAt ? ` · submitted ${formatDateTimeMY(r.submittedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditContent(r, user.actor) && (
            <Button asChild variant="outline">
              <Link href={`/requests/${r.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          <CloneButton requestId={r.id} />
          <Button asChild variant="primary">
            <a href={`${BASE_PATH}/api/requests/${r.id}/pdf`} target="_blank" rel="noopener">
              <Printer /> Print PDF
            </a>
          </Button>
        </div>
      </header>

      <Panel>
        <PanelBody className="py-5">
          <ProgressTracker stations={stations} status={r.status} />
        </PanelBody>
      </Panel>

      <ActionPanel requestId={r.id} version={r.version} actions={actions} stageLabel={stage ? STAGE_LABEL[stage] : ""} buName={d.businessUnit?.name ?? null} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <PanelHeader title="Training program" />
            <PanelBody className="space-y-5">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Fact icon={CalendarDays} label="Date(s)">{formatDateRange(r.startDate, r.endDate)}</Fact>
                <Fact icon={Clock} label="Time">{`${formatTime12(r.startTime)} – ${formatTime12(r.endTime)}`}</Fact>
                <Fact icon={MapPin} label="Venue">{r.venue ?? "—"}</Fact>
                <Fact icon={Presentation} label="Conducted by">{r.conductedBy ?? "—"}</Fact>
                <Fact icon={Wallet} label="Fees">
                  {formatMYR(total)}
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    ({d.candidates.length} × {formatMYR(r.feePerPax)})
                  </span>
                </Fact>
              </dl>
              {r.objective && (
                <div>
                  <h3 className="text-xs text-muted">Objective</h3>
                  <p className="mt-1 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.objective}</p>
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Proposed candidates" description={`${d.candidates.length} of 8`} />
            <ol className="grid sm:grid-cols-2">
              {d.candidates.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-line px-5 py-3 sm:odd:border-r">
                  <span className="w-5 text-xs font-semibold tabular text-muted">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{[c.jobTitle, c.department, c.staffNo && `Staff no. ${c.staffNo}`].filter(Boolean).join(" · ") || c.email || "Added manually"}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <Tabs defaultValue="timeline">
              <TabsList className="px-3">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="comments">
                  Comments <span className="rounded-full bg-ground px-1.5 text-xs tabular">{d.comments.length}</span>
                </TabsTrigger>
                <TabsTrigger value="versions">
                  Versions <span className="rounded-full bg-ground px-1.5 text-xs tabular">{d.revisions.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="px-5 py-5 outline-none">
                <Timeline actions={d.actions} />
              </TabsContent>
              <TabsContent value="comments" className="px-5 py-5 outline-none">
                <Comments requestId={r.id} canComment={canComment(r, user.actor)} items={d.comments} />
              </TabsContent>
              <TabsContent value="versions" className="px-5 py-5 outline-none">
                <Revisions revisions={d.revisions as never} />
              </TabsContent>
            </Tabs>
          </Panel>
        </div>

        <div className="space-y-6">
          {showLnd && (
            <Panel>
              <PanelHeader title="L&D assessment" description={canEditLndFields(r, user.actor) ? "Complete during your review" : undefined} />
              <PanelBody>
                {canEditLndFields(r, user.actor) ? (
                  <LndFieldsForm requestId={r.id} version={r.version} initial={{ hrdcClaimable: r.hrdcClaimable, hrdcGrantNo: r.hrdcGrantNo, lndRemarks: r.lndRemarks }} />
                ) : (
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">HRD Corp claimable</dt>
                      <dd className="font-medium">{r.hrdcClaimable === null ? "Not assessed" : r.hrdcClaimable ? "Yes" : "No"}</dd>
                    </div>
                    {r.hrdcGrantNo && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted">Grant no.</dt>
                        <dd className="font-medium tabular">{r.hrdcGrantNo}</dd>
                      </div>
                    )}
                    {r.lndRemarks && <p className="whitespace-pre-wrap rounded-lg bg-ground px-3 py-2 text-ink">{r.lndRemarks}</p>}
                  </dl>
                )}
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Attachments" />
            {d.attachments.length ? (
              <ul className="divide-y divide-line">
                {d.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`${BASE_PATH}/api/attachments/${a.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                      <FileText className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{a.originalName}</span>
                      <span className="text-xs tabular text-muted">{formatBytes(a.sizeBytes)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <PanelBody>
                <p className="text-sm text-muted">No attachments.</p>
              </PanelBody>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
