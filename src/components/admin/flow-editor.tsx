"use client";
import * as React from "react";
import { Check, Minus, PencilLine } from "lucide-react";
import { saveBusinessUnitFlowAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useAdminAction } from "./use-admin-action";

type StepKey = "REQUESTER" | "HOD" | "BU" | "LND" | "HR";

export interface FlowUnit {
  id: string;
  code: string;
  name: string;
  requiresBuAdmin: boolean;
  requiresHrApproval: boolean;
  buAdmins: string[];
  stepNotes: Partial<Record<StepKey, string>>;
  notes: Record<StepKey, string>;
}

const TITLE: Record<StepKey, string> = { REQUESTER: "Raise", HOD: "Department HOD", BU: "BU Admin", LND: "L&D Team", HR: "HR Head" };

/** An accessible on/off switch (role="switch"). */
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-approved" : "bg-line-strong",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-150", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

/** One business unit's approval flow, drawn as numbered steps (Raise → HOD → BU Admin → L&D → HR Head → Approved). */
export function FlowCard({ unit, readOnly }: { unit: FlowUnit; readOnly: boolean }) {
  const { busy, exec } = useAdminAction();
  const [confirm, setConfirm] = React.useState<StepKey | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  // Each control sends only what it changed, so it can't undo another admin's change.
  const save = (patch: Partial<Pick<FlowUnit, "requiresBuAdmin" | "requiresHrApproval" | "stepNotes">>, message: string) =>
    exec(saveBusinessUnitFlowAction(unit.id, patch), message);

  const toggle = (step: "BU" | "HR", on: boolean) => {
    if (!on) return setConfirm(step); // switching a step off is confirmed first
    void save(step === "BU" ? { requiresBuAdmin: true } : { requiresHrApproval: true }, `${TITLE[step]} step switched on for ${unit.name}`);
  };

  const steps: { key: StepKey; on: boolean; optional?: "BU" | "HR"; extra?: string }[] = [
    { key: "REQUESTER", on: true },
    { key: "HOD", on: true },
    { key: "BU", on: unit.requiresBuAdmin, optional: "BU", extra: unit.buAdmins.length ? unit.buAdmins.join(", ") : "No BU Admin assigned" },
    { key: "LND", on: true },
    { key: "HR", on: unit.requiresHrApproval, optional: "HR" },
  ];
  let n = 0;

  return (
    <Panel role="region" aria-label={`${unit.name} approval flow`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
          <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-surface">{unit.code}</span>
          {unit.name}
        </h2>
        <Button variant="ghost" size="sm" disabled={readOnly || busy} onClick={() => setEditOpen(true)}>
          <PencilLine /> Edit descriptions
        </Button>
      </div>

      <ol className="grid gap-5 px-5 py-6 sm:grid-cols-6 sm:gap-0 sm:px-6">
        {steps.map((s) => {
          const num = s.on ? ++n : null;
          return (
            <li key={s.key} className="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-4">
              {/* Thin line joining each step to the next (horizontal from 640px). */}
              <span aria-hidden className="absolute left-[13px] top-8 h-[calc(100%-0.5rem)] w-px bg-line-strong sm:left-9 sm:right-1 sm:top-[13px] sm:h-px sm:w-auto" />
              <span
                className={cn(
                  "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular ring-1",
                  s.on ? "bg-surface-2 text-ink ring-line-strong" : "bg-surface text-muted ring-line",
                )}
              >
                {num ?? <Minus className="size-3.5" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", s.on ? "text-ink" : "text-muted line-through")}>{TITLE[s.key]}</span>
                <span className="block text-[13px] text-muted">{s.on ? unit.notes[s.key] : "Skipped"}</span>
                {s.on && s.extra && <span className="mt-0.5 block truncate text-xs text-ink-2">{s.extra}</span>}
                {s.optional && (
                  <span className="mt-2 flex items-center gap-2">
                    <Switch checked={s.on} disabled={readOnly || busy} label={`${TITLE[s.key]} step`} onChange={(v) => toggle(s.optional!, v)} />
                    <span className="text-xs text-muted">{s.on ? "On" : "Off"}</span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
        <li className="relative flex gap-3 sm:flex-col sm:gap-2">
          <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-approved text-white">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Approved</span>
            <span className="block text-[13px] text-muted">by {unit.requiresHrApproval ? "HR Head" : "L&D Team"}</span>
          </span>
        </li>
      </ol>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent title={`Skip the ${confirm ? TITLE[confirm] : ""} step?`}>
          <p className="text-sm text-ink-2">
            New approvals for {unit.name} will skip the {confirm ? TITLE[confirm] : ""}. Requests already waiting there stay with them.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Keep it on</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                const step = confirm!;
                if (await save(step === "BU" ? { requiresBuAdmin: false } : { requiresHrApproval: false }, `${TITLE[step]} step skipped for ${unit.name}`)) setConfirm(null);
              }}
            >
              Skip this step
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title={`Step descriptions · ${unit.name}`} description="Shown under each step. Leave a field empty to use the default.">
          {/* Mounted only while open, so it always starts from the saved notes. */}
          <NotesForm unit={unit} busy={busy} onSave={async (stepNotes) => (await save({ stepNotes }, "Step descriptions saved")) && setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function NotesForm({ unit, busy, onSave }: { unit: FlowUnit; busy: boolean; onSave: (notes: Partial<Record<StepKey, string>>) => void }) {
  const [notes, setNotes] = React.useState<Partial<Record<StepKey, string>>>(unit.stepNotes);
  const keys: StepKey[] = ["REQUESTER", "HOD", ...(unit.requiresBuAdmin ? (["BU"] as const) : []), "LND", ...(unit.requiresHrApproval ? (["HR"] as const) : [])];
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(notes);
      }}
    >
      {keys.map((k) => (
        <Field key={k} label={TITLE[k]} htmlFor={`note-${unit.id}-${k}`}>
          <Input
            id={`note-${unit.id}-${k}`}
            value={notes[k] ?? ""}
            placeholder={unit.notes[k]}
            maxLength={40}
            onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))}
          />
        </Field>
      ))}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          Save descriptions
        </Button>
      </div>
    </form>
  );
}
