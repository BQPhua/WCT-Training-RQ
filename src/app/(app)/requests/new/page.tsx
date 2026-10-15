import { RequestForm } from "@/components/request-form/request-form";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { requesterContext } from "@/lib/services/form-data";

export const metadata = { title: "New Training Requisition" };

export default async function NewRequestPage() {
  const user = await requireUser();
  const ctx = await requesterContext(user);
  return (
    <>
      <PageHeader title="New Training Requisition" description="Training Requisition Form" />
      <RequestForm
        {...ctx}
        initial={{ trainingType: "", title: "", objective: "", relevancy: "", startDate: "", endDate: "", startTime: "09:00", endTime: "17:00", feePerPax: "", venue: "", conductedBy: "" }}
        initialCandidates={[]}
        initialParticipantCount={null}
        initialNameList={null}
        initialAttachments={[]}
      />
    </>
  );
}
