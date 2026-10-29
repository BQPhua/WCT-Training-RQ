import { notFound, redirect } from "next/navigation";
import { CornerUpLeft } from "lucide-react";
import { RequestForm } from "@/components/request-form/request-form";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { formValuesFrom, requesterContext } from "@/lib/services/form-data";
import { getRequestForUser } from "@/lib/services/requests";
import { canEditContent } from "@/lib/workflow";

export const metadata = { title: "Edit request" };

export default async function EditRequestPage({ params, searchParams }: PageProps<"/requests/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getRequestForUser(user, id);
  if (!detail) notFound();
  if (!canEditContent(detail.request, user.actor)) redirect(`/requests/${id}`);
  const ctx = await requesterContext(user);
  const lastReject = [...detail.actions].reverse().find((a) => a.action === "REJECT");
  const isReturned = detail.request.status === "RETURNED";

  return (
    <>
      <PageHeader
        title={isReturned ? `Amend ${detail.request.refNo}` : detail.request.refNo ? `Edit ${detail.request.refNo}` : "Edit draft"}
        description="Training Requisition Form"
        actions={<StatusBadge status={detail.request.status} />}
      />
      {sp.cloned && <p className="mb-5 rounded-lg bg-info-soft px-4 py-3 text-sm text-info-text">This is a copy. Check the dates and candidates before submitting.</p>}
      {isReturned && lastReject && (
        <div className="mb-5 flex gap-3 rounded-xl border border-returned/30 bg-returned-soft px-4 py-3.5">
          <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-returned-text" />
          <div className="text-sm">
            <p className="font-medium text-returned-text">Returned by {lastReject.actor.name}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-ink">{lastReject.remark}</p>
          </div>
        </div>
      )}
      <RequestForm id={id} version={detail.request.version} isReturned={isReturned} {...ctx} {...formValuesFrom(detail)} />
    </>
  );
}
