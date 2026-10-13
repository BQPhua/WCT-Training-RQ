"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, CornerUpLeft, Loader2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { workflowAction } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  STAGE_LABEL,
  type AllowedAction,
  type NotifyTarget,
  type Stage,
} from "@/lib/workflow";

const NOTIFY_LABEL: Record<NotifyTarget, string> = {
  REQUESTER: "Requester",
  HOD: "Department HOD",
  LND: "L&D Team",
};
const STAGE_TO_NOTIFY: Partial<Record<Stage, NotifyTarget>> = {
  REQUESTER: "REQUESTER",
  HOD: "HOD",
  LND: "LND",
};
const SEND_BACK_HINT: Record<Stage, string> = {
  REQUESTER: "Requester amends and resubmits; approval restarts at the HOD.",
  HOD: "The Department HOD reviews it again.",
  LND: "The L&D Team reviews it again.",
  HR: "",
};

export function ActionPanel({
  requestId,
  version,
  actions,
  stageLabel,
  buName,
}: {
  requestId: string;
  version: number;
  actions: AllowedAction[];
  stageLabel: string;
  buName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [remark, setRemark] = React.useState("");
  const [remarkError, setRemarkError] = React.useState<string>();
  const reject = actions.find((a) => a.type === "REJECT");
  const options = reject?.sendBackOptions ?? [];
  const [sendBackTo, setSendBackTo] = React.useState<Stage>(
    options[0] ?? "REQUESTER",
  );
  const [notify, setNotify] = React.useState<NotifyTarget[]>([]);
  const has = (t: AllowedAction["type"]) => actions.some((a) => a.type === t);
  const lockedTarget = STAGE_TO_NOTIFY[sendBackTo];

  async function run(
    type: AllowedAction["type"],
    extra: Record<string, unknown> = {},
  ) {
    if ((type === "REJECT" || type === "CANCEL") && remark.trim().length < 3) {
      setRemarkError("Please give a reason (at least 3 characters).");
      return;
    }
    setBusy(type);
    const r = await workflowAction({
      requestId,
      version,
      type,
      remark: remark.trim() || undefined,
      ...extra,
    });
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      router.refresh();
      return;
    }
    setRejectOpen(false);
    setCancelOpen(false);
    setApproveOpen(false);
    setRemark("");
    toast.success(
      type === "APPROVE"
        ? "Approved and passed to the next stage"
        : type === "REJECT"
          ? `Sent back to ${STAGE_LABEL[sendBackTo]}`
          : type === "CANCEL"
            ? "Request cancelled"
            : "Submitted",
    );
    router.refresh();
  }

  if (!actions.length) return null;

  const approver = has("APPROVE");
  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-4 sm:p-5",
          approver
            ? "border-pending/60 bg-pending-soft/60"
            : "border-line bg-surface",
        )}
      >
        {approver && (
          <p className="text-sm text-ink sm:mb-3">
            <span className="font-semibold">Your decision is needed</span> as{" "}
            {stageLabel}.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {has("APPROVE") && (
            <Button
              variant="approve"
              size="lg"
              onClick={() => setApproveOpen(true)}
              disabled={!!busy}
              className="hidden sm:inline-flex"
            >
              <Check /> Approve
            </Button>
          )}
          {reject && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setRejectOpen(true)}
              disabled={!!busy}
              className="hidden text-returned-text sm:inline-flex"
            >
              <CornerUpLeft /> Reject &amp; send back
            </Button>
          )}
          {(has("SUBMIT") || has("RESUBMIT")) && (
            <Button asChild variant="brand" size="lg">
              <Link href={`/requests/${requestId}/edit`}>
                {has("RESUBMIT") ? <Pencil /> : <Send />}{" "}
                {has("RESUBMIT") ? "Amend & resubmit" : "Continue & submit"}
              </Link>
            </Button>
          )}
          {has("CANCEL") && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setCancelOpen(true)}
              disabled={!!busy}
              className="sm:ml-auto"
            >
              <Ban /> Cancel request
            </Button>
          )}
        </div>

        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogContent
            title="Approve this request?"
            description={`You are approving as ${stageLabel}. Everyone involved will be notified.`}
          >
            <Field label="Remark (optional)" htmlFor="approve-remark">
              <Textarea
                id="approve-remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                maxLength={2000}
                placeholder="e.g. Within this year's training budget"
              />
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Back</Button>
              </DialogClose>
              <Button
                variant="approve"
                onClick={() => run("APPROVE")}
                disabled={!!busy}
              >
                {busy === "APPROVE" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}{" "}
                Approve
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent
            title="Reject and send back"
            description="Choose where the request goes and who should be told. A remark is required."
          >
            {options.length > 1 && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                  Send back to
                </legend>
                <div className="grid gap-2">
                  {options.map((o) => (
                    <label
                      key={o}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                        sendBackTo === o
                          ? "border-returned bg-returned-soft/60"
                          : "border-line-strong hover:border-ink-2/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="sendBack"
                        value={o}
                        checked={sendBackTo === o}
                        onChange={() => setSendBackTo(o)}
                        className="mt-0.5 size-4"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">
                          {STAGE_LABEL[o]}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {SEND_BACK_HINT[o]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="mb-5">
              <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                Notify
              </legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(["REQUESTER", "HOD", "LND"] as NotifyTarget[]).map((t) => {
                  const locked = lockedTarget === t;
                  const checked = locked || notify.includes(t);
                  return (
                    <label
                      key={t}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                        locked ? "text-muted" : "cursor-pointer hover:bg-ink/5",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={checked}
                        disabled={locked}
                        onChange={(e) =>
                          setNotify((n) =>
                            e.target.checked
                              ? [...n, t]
                              : n.filter((x) => x !== t),
                          )
                        }
                      />
                      {NOTIFY_LABEL[t]}
                      {locked && <span className="text-xs">(receives it)</span>}
                    </label>
                  );
                })}
                <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted">
                  <input type="checkbox" className="size-4" checked disabled />
                  {buName ? `${buName} BU Admin` : "BU Admin"}{" "}
                  <span className="text-xs">(always)</span>
                </label>
              </div>
            </fieldset>

            <Field
              label="Remark"
              htmlFor="reject-remark"
              required
              error={remarkError}
            >
              <Textarea
                id="reject-remark"
                required
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                  setRemarkError(undefined);
                }}
                maxLength={2000}
                aria-invalid={!!remarkError}
                placeholder="Explain what needs to change"
              />
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Back</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={() =>
                  run("REJECT", {
                    sendBackTo,
                    notify: notify.filter((n) => n !== lockedTarget),
                  })
                }
                disabled={!!busy}
              >
                {busy === "REJECT" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CornerUpLeft />
                )}{" "}
                Send back to {STAGE_LABEL[sendBackTo]}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent
            title="Cancel this request?"
            description="Cancelled requests are kept in history but can't be reopened. You can clone it later."
          >
            <Field
              label="Reason"
              htmlFor="cancel-remark"
              required
              error={remarkError}
            >
              <Textarea
                id="cancel-remark"
                value={remark}
                onChange={(e) => (
                  setRemark(e.target.value),
                  setRemarkError(undefined)
                )}
                aria-invalid={!!remarkError}
                maxLength={2000}
              />
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Keep request</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={() => run("CANCEL")}
                disabled={!!busy}
              >
                {busy === "CANCEL" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Ban />
                )}{" "}
                Cancel request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {approver && (
        <>
          <div aria-hidden className="h-16 sm:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:hidden">
            <Button
              variant="approve"
              size="lg"
              className="flex-1 px-3"
              onClick={() => setApproveOpen(true)}
              disabled={!!busy}
            >
              <Check /> Approve
            </Button>
            {reject && (
              <Button
                variant="outline"
                size="lg"
                className="flex-1 px-3 text-returned-text"
                onClick={() => setRejectOpen(true)}
                disabled={!!busy}
              >
                <CornerUpLeft /> Reject &amp; send back
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
