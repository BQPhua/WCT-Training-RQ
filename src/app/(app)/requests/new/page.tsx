import { RequestForm } from "@/components/request-form/request-form";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { requesterContext } from "@/lib/services/form-data";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  const user = await requireUser();
  const ctx = await requesterContext(user);
  return (
    <>
      <PageHeader title="New training request" description="Training Requisition Form · WCT-F-4.18-2 (REV2)" />
      <RequestForm
        {...ctx}
        initial={{ trainingType: "", title: "", objective: "", startDate: "", endDate: "", startTime: "09:00", endTime: "17:00", feePerPax: "", venue: "", conductedBy: "" }}
        initialCandidates={[]}
        initialAttachments={[]}
      />
    </>
  );
}
