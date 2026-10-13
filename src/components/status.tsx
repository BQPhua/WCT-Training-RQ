import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Status } from "@/lib/workflow";

export type Tone = "approved" | "pending" | "returned" | "cancelled" | "draft";

export function toneOf(status: Status): Tone {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "PENDING_HOD":
    case "PENDING_LND":
    case "PENDING_HR":
      return "pending";
    case "RETURNED":
      return "returned";
    case "CANCELLED":
      return "cancelled";
    default:
      return "draft";
  }
}

const BADGE: Record<Tone, string> = {
  approved: "bg-approved-soft text-approved-text ring-approved/30",
  pending: "bg-pending-soft text-pending-text ring-pending/50",
  returned: "bg-returned-soft text-returned-text ring-returned/30",
  cancelled: "bg-cancelled-soft text-cancelled-text ring-cancelled/40",
  draft: "bg-draft text-draft-text ring-line-strong",
};

export const DOT: Record<Tone, string> = {
  approved: "bg-approved",
  pending: "bg-pending",
  returned: "bg-returned",
  cancelled: "bg-cancelled",
  draft: "bg-line-strong",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const tone = toneOf(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE[tone], className)}>
      <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
