import { Ban, Check, CornerUpLeft, FilePlus2, PencilLine, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeMY } from "@/lib/format";
import { STATUS_LABEL, type Status } from "@/lib/workflow";

export interface TimelineAction {
  id: string;
  action: string;
  fromStatus: Status | null;
  toStatus: Status | null;
  sentBackTo: string | null;
  remark: string | null;
  selfApproved: boolean;
  notified: { name: string; email: string }[] | null;
  createdAt: Date;
  actor: { name: string };
}

const META: Record<string, { icon: typeof Check; tone: string; verb: string }> = {
  CREATE: { icon: FilePlus2, tone: "bg-draft text-draft-text", verb: "created the draft" },
  SUBMIT: { icon: Send, tone: "bg-shell text-shell-fg", verb: "submitted the request" },
  RESUBMIT: { icon: Send, tone: "bg-shell text-shell-fg", verb: "resubmitted the request" },
  APPROVE: { icon: Check, tone: "bg-approved text-white", verb: "approved" },
  REJECT: { icon: CornerUpLeft, tone: "bg-returned text-white", verb: "rejected and returned it to the requester" },
  CANCEL: { icon: Ban, tone: "bg-cancelled text-white", verb: "cancelled the request" },
  EDIT_LND_FIELDS: { icon: PencilLine, tone: "bg-info-soft text-info-text", verb: "updated the L&D details" },
};

const STAGE_OF_FROM: Partial<Record<Status, string>> = { PENDING_HOD: "Department HOD", PENDING_BU: "BU Admin", PENDING_LND: "L&D", PENDING_HR: "HR Head" };

export function Timeline({ actions }: { actions: TimelineAction[] }) {
  return (
    <ol className="space-y-0">
      {[...actions].reverse().map((a, i, arr) => {
        const m = META[a.action] ?? META.CREATE;
        const Icon = m.icon;
        return (
          <li key={a.id} className="relative flex gap-3.5 pb-6 last:pb-0">
            {i < arr.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-line" />}
            <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface", m.tone)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-ink">
                <span className="font-semibold">{a.actor.name}</span> {m.verb}
                {a.action === "APPROVE" && a.fromStatus && STAGE_OF_FROM[a.fromStatus] ? ` as ${STAGE_OF_FROM[a.fromStatus]}` : ""}
                {a.action === "REJECT" && a.fromStatus && STAGE_OF_FROM[a.fromStatus] ? ` as ${STAGE_OF_FROM[a.fromStatus]}` : ""}
                {a.action === "APPROVE" && a.fromStatus === "PENDING_LND" && a.toStatus === "APPROVED" && (
                  <span className="ml-2 rounded bg-approved-soft px-1.5 py-0.5 text-[11px] font-medium text-approved-text">{"Final approval (L&D)"}</span>
                )}
                {a.selfApproved && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info-text">Self-approved</span>}
              </p>
              <p className="mt-0.5 text-xs tabular text-muted">
                {formatDateTimeMY(a.createdAt)}
                {a.toStatus && a.fromStatus !== a.toStatus ? ` · ${STATUS_LABEL[a.toStatus]}` : ""}
              </p>
              {a.remark && <blockquote className="mt-2 whitespace-pre-wrap rounded-lg bg-ground px-3.5 py-2.5 text-sm text-ink">{a.remark}</blockquote>}
              {!!a.notified?.length && (
                <details className="group mt-2 text-xs text-muted">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded hover:text-ink">
                    <Users className="size-3.5" /> Notified {a.notified.length} {a.notified.length === 1 ? "person" : "people"}
                  </summary>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.notified.map((n) => (
                      <li key={n.email} className="rounded-full bg-ground px-2 py-0.5 text-ink-2" title={n.email}>
                        {n.name}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
