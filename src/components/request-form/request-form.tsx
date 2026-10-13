"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, CircleAlert, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { saveDraftAction, setMyDepartmentAction, submitRequestAction } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { BASE_PATH } from "@/lib/env";
import { formatDateRange, formatMYR, formatTime12, totalFees } from "@/lib/format";
import { requestFormSchema, type DraftInput } from "@/lib/validation/request";
import { AttachmentField, type AttachmentItem } from "./attachment-field";
import { CandidatePicker, type CandidateRow } from "./candidate-picker";

export interface FormValues {
  trainingType: "" | "PLANNED" | "ADHOC";
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  feePerPax: string;
  venue: string;
  conductedBy: string;
}

export interface RequestFormProps {
  id?: string;
  version?: number;
  isReturned?: boolean;
  initial: FormValues;
  initialCandidates: Omit<CandidateRow, "key">[];
  initialAttachments: AttachmentItem[];
  requester: { name: string; department: string | null; businessUnit: string | null; hodName: string | null };
  departments: { id: string; name: string; buName: string }[];
}

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2";
const uid = () => Math.random().toString(36).slice(2, 10);

function Section({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Panel aria-labelledby={`sec-${n}`} className="animate-rise">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
        <h2 id={`sec-${n}`} className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
          <span className="mr-2 tabular text-brand-text">Section {n}</span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </Panel>
  );
}

export function RequestForm(props: RequestFormProps) {
  const router = useRouter();
  const [id, setId] = React.useState(props.id);
  const [version, setVersion] = React.useState(props.version);
  const [v, setV] = React.useState<FormValues>(props.initial);
  const [candidates, setCandidates] = React.useState<CandidateRow[]>(props.initialCandidates.map((c) => ({ ...c, key: uid() })));
  const [attachments, setAttachments] = React.useState(props.initialAttachments);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [review, setReview] = React.useState(false);
  const [deptId, setDeptId] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  const needsDepartment = !props.requester.department;
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setDirty(true);
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function payload(): DraftInput {
    return {
      ...v,
      trainingType: v.trainingType || undefined,
      endDate: v.endDate || v.startDate,
      candidates: candidates.map(({ key: _k, manual: _m, ...c }) => ({ ...c, name: c.name.trim() })),
    };
  }

  async function saveDraft(silent = false): Promise<{ id: string; version: number } | null> {
    if (!v.title.trim()) {
      setErrors({ title: "Add a training title before saving." });
      document.getElementById("title")?.focus();
      return null;
    }
    setSaving(true);
    const r = await saveDraftAction({ id, version, data: payload() });
    setSaving(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
      if (r.error.includes("already actioned") || r.error.includes("changed since")) router.refresh();
      return null;
    }
    setId(r.id);
    setVersion(r.version);
    setDirty(false);
    if (!id) window.history.replaceState(null, "", `${BASE_PATH}/requests/${r.id}/edit`);
    if (!silent) toast.success("Draft saved");
    return r;
  }

  function openReview() {
    const parsed = requestFormSchema.safeParse(payload());
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[i.path[0] === "candidates" ? "candidates" : String(i.path[0])] ??= i.message;
    if (needsDepartment) errs.department = "Select your department.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please complete the highlighted fields.");
      const first = Object.keys(errs)[0];
      document.getElementById(first === "candidates" ? "candidates-anchor" : first)?.focus();
      return;
    }
    setReview(true);
  }

  async function submit() {
    setSubmitting(true);
    const r = await submitRequestAction({ id, version, data: payload(), resubmit: !!props.isReturned });
    // On success the action redirects; we only get here on failure.
    setSubmitting(false);
    if (r && !r.ok) {
      setReview(false);
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
    }
  }

  async function chooseDepartment() {
    if (!deptId) return;
    const r = await setMyDepartmentAction(deptId);
    if (r.ok) {
      toast.success("Department saved to your profile");
      router.refresh();
    } else toast.error(r.error);
  }

  const total = totalFees(v.feePerPax, candidates.length);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        openReview();
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="min-w-0 space-y-5">
        <Section n={1} title="General details">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className={LABEL}>To</dt>
              <dd className="mt-1 text-[15px] text-ink">Human Resources and Administration Department</dd>
            </div>
            <div>
              <dt className={LABEL}>From (requisitioner)</dt>
              <dd className="mt-1 text-[15px] text-ink">{props.requester.name}</dd>
            </div>
            <div>
              <dt className={LABEL}>Department</dt>
              <dd className="mt-1 text-[15px] text-ink">
                {props.requester.department ? (
                  <>
                    {props.requester.department}
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ground px-2 py-0.5 text-xs text-muted">
                      <Building2 className="size-3" /> {props.requester.businessUnit}
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col gap-2 sm:flex-row">
                    <NativeSelect id="department" value={deptId} onChange={(e) => setDeptId(e.target.value)} aria-invalid={!!errors.department} aria-describedby="department-error">
                      <option value="">Select your department…</option>
                      {props.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.buName})
                        </option>
                      ))}
                    </NativeSelect>
                    <Button type="button" variant="primary" onClick={chooseDepartment} disabled={!deptId}>
                      Save
                    </Button>
                  </span>
                )}
              </dd>
              {errors.department && <p id="department-error" className="mt-1.5 text-[13px] text-danger">{errors.department}</p>}
            </div>
          </dl>
        </Section>

        <Section n={2} title="Training program details">
          <p className="text-sm text-muted">I would like to propose the following staff to attend the training program detailed below.</p>
          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Training type<span className="ml-0.5 text-danger" aria-hidden>*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2" id="trainingType" tabIndex={-1}>
              {[
                ["PLANNED", "Planned training", "Part of the department's annual training plan."],
                ["ADHOC", "Ad hoc training", "An unplanned need that came up during the year."],
              ].map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                    v.trainingType === value ? "border-brand bg-brand-soft/50" : "border-line-strong hover:border-ink-2/40",
                    errors.trainingType && "border-danger",
                  )}
                >
                  <input type="radio" name="trainingType" value={value} checked={v.trainingType === value} onChange={set("trainingType")} className="mt-0.5 size-4" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{label}</span>
                    <span className="block text-[13px] text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.trainingType && <p className="mt-1.5 text-[13px] text-danger">{errors.trainingType}</p>}
          </fieldset>

          <Field label="Proposed training program's title / subject" htmlFor="title" required error={errors.title}>
            <Input id="title" required maxLength={200} value={v.title} onChange={set("title")} aria-invalid={!!errors.title} aria-describedby="title-error" placeholder="e.g. Advanced Contract Administration (CIDB)" />
          </Field>
          <Field label="Objective" htmlFor="objective" required error={errors.objective} hint="What should participants be able to do afterwards?">
            <Textarea id="objective" required maxLength={2000} value={v.objective} onChange={set("objective")} aria-invalid={!!errors.objective} aria-describedby="objective-error" />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Start date" htmlFor="startDate" required error={errors.startDate}>
              <Input id="startDate" type="date" required value={v.startDate} onChange={set("startDate")} aria-invalid={!!errors.startDate} />
            </Field>
            <Field label="End date" htmlFor="endDate" error={errors.endDate} hint="Leave blank for one day">
              <Input id="endDate" type="date" min={v.startDate || undefined} value={v.endDate} onChange={set("endDate")} aria-invalid={!!errors.endDate} />
            </Field>
            <Field label="Start time" htmlFor="startTime" required error={errors.startTime}>
              <Input id="startTime" type="time" required value={v.startTime} onChange={set("startTime")} aria-invalid={!!errors.startTime} />
            </Field>
            <Field label="End time" htmlFor="endTime" required error={errors.endTime}>
              <Input id="endTime" type="time" required value={v.endTime} onChange={set("endTime")} aria-invalid={!!errors.endTime} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Venue" htmlFor="venue" required error={errors.venue}>
              <Input id="venue" required maxLength={200} value={v.venue} onChange={set("venue")} aria-invalid={!!errors.venue} placeholder="e.g. WCT Tower, Level 12 / Online (Teams)" />
            </Field>
            <Field label="Conducted by" htmlFor="conductedBy" required error={errors.conductedBy}>
              <Input id="conductedBy" required maxLength={200} value={v.conductedBy} onChange={set("conductedBy")} aria-invalid={!!errors.conductedBy} placeholder="Training provider or trainer" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fees per participant (MYR)" htmlFor="feePerPax" required error={errors.feePerPax}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">RM</span>
                <Input id="feePerPax" inputMode="decimal" required value={v.feePerPax} onChange={set("feePerPax")} aria-invalid={!!errors.feePerPax} placeholder="0.00" className="pl-10 tabular" />
              </div>
            </Field>
            <div className="space-y-1.5">
              <span className={LABEL}>Total fees</span>
              <p className="flex h-10 items-center rounded-md bg-ground px-3 text-[15px] font-semibold tabular text-ink">
                {formatMYR(total)}
                <span className="ml-2 text-xs font-normal text-muted">
                  {candidates.length} × {formatMYR(v.feePerPax || 0)}
                </span>
              </p>
            </div>
          </div>
        </Section>

        <Section n={3} title="Proposed candidates" aside={<span className="text-xs tabular text-muted">{candidates.length} / 8</span>}>
          <span id="candidates-anchor" tabIndex={-1} />
          <CandidatePicker
            value={candidates}
            onChange={(rows) => {
              setCandidates(rows);
              setDirty(true);
              if (errors.candidates) setErrors(({ candidates: _c, ...rest }) => rest);
            }}
            error={errors.candidates}
          />
        </Section>

        <Panel className="animate-rise">
          <div className="border-b border-line px-5 py-3.5 sm:px-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">Supporting documents</h2>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <AttachmentField items={attachments} onChange={setAttachments} ensureSaved={async () => id ?? (await saveDraft(true))?.id ?? null} />
          </div>
        </Panel>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Panel>
          <div className="space-y-4 px-5 py-5">
            <h2 className="text-[15px] font-semibold">Approval route</h2>
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line-strong">
              {[
                ["You submit", props.requester.name],
                ["Department HOD", props.requester.hodName ?? "Not assigned — contact HR"],
                ["L&D Team", "Any L&D member reviews"],
                ["HR Head", "Final approval"],
              ].map(([stage, who], i) => (
                <li key={stage} className="relative flex gap-3 pl-0">
                  <span className={cn("relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 bg-surface", i === 0 ? "border-brand" : "border-line-strong")} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{stage}</span>
                    <span className={cn("block text-[13px]", !props.requester.hodName && i === 1 ? "text-danger" : "text-muted")}>{who}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="border-t border-line pt-4 text-[13px] text-muted">
              {props.requester.businessUnit ? `Your ${props.requester.businessUnit} BU Admin is kept informed.` : "Your BU Admin is kept informed."}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-line bg-surface-2 px-5 py-4">
            <Button type="submit" variant="brand" size="lg" disabled={saving || submitting}>
              <Send /> {props.isReturned ? "Review & resubmit" : "Review & submit"}
            </Button>
            <Button type="button" variant="outline" onClick={() => saveDraft()} disabled={saving || submitting}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save draft
            </Button>
            {dirty && <p className="text-center text-xs text-muted">Unsaved changes</p>}
          </div>
        </Panel>
      </aside>

      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent title={props.isReturned ? "Resubmit this request?" : "Submit this request?"} description={`It will go to ${props.requester.hodName ?? "your HOD"} for approval.`}>
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            {[
              ["Training", v.title],
              ["Type", v.trainingType === "PLANNED" ? "Planned training" : "Ad hoc training"],
              ["When", `${formatDateRange(v.startDate, v.endDate || v.startDate)}, ${formatTime12(v.startTime)} – ${formatTime12(v.endTime)}`],
              ["Venue", v.venue],
              ["Candidates", `${candidates.length}: ${candidates.map((c) => c.name).join(", ")}`],
              ["Total fees", formatMYR(total)],
            ].map(([k, val]) => (
              <div key={k} className="grid grid-cols-[96px_1fr] gap-3 px-3 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{val}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex gap-2 text-[13px] text-muted">
            <CalendarDays className="mt-0.5 size-4 shrink-0" /> You can&apos;t edit the request while it is being reviewed. Approvers may send it back to you for changes.
          </p>
          {!props.requester.hodName && (
            <p className="mt-3 flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> Your department has no HOD assigned, so this can&apos;t be submitted yet. Please contact HR.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Keep editing
              </Button>
            </DialogClose>
            <Button type="button" variant="brand" onClick={submit} disabled={submitting || !props.requester.hodName}>
              {submitting ? <Loader2 className="animate-spin" /> : <ArrowRight />} {props.isReturned ? "Resubmit" : "Submit to HOD"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
