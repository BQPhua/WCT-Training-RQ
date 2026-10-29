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
import type { AllowedAction } from "@/lib/workflow";

export function ActionPanel({
  requestId,
  version,
  actions,
  stageLabel,
}: {
  requestId: string;
  version: number;
  actions: AllowedAction[];
  stageLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [remark, setRemark] = React.useState("");
  const [remarkError, setRemarkError] = React.useState<string>();
  const reject = actions.find((a) => a.type === "REJECT");
  const has = (t: AllowedAction["type"]) => actions.some((a) => a.type === t);

  async function run(type: AllowedAction["type"]) {
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
        ? r.status === "APPROVED"
          ? "Final approval given. The request is approved."
          : "Approved and passed to the next stage"
        : type === "REJECT"
          ? "Returned to requester"
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
              <CornerUpLeft /> Reject
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
            title="Reject and return to requester"
            description="The requester will amend and resubmit; approval restarts at the Department HOD. Everyone who approved this round is copied."
          >
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
                onClick={() => run("REJECT")}
                disabled={!!busy}
              >
                {busy === "REJECT" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CornerUpLeft />
                )}{" "}
                Reject
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
                <CornerUpLeft /> Reject
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
