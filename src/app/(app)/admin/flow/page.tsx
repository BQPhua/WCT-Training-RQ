import { FlowCard } from "@/components/admin/flow-editor";
import { requireUser } from "@/lib/auth/current-user";
import { isDemoUser } from "@/lib/auth/roles";
import { flowOverview } from "@/lib/services/admin";

export const metadata = { title: "Admin · Approval flow" };

export default async function FlowPage() {
  const user = await requireUser();
  const units = await flowOverview(user);
  return (
    <div className="space-y-5">
      <p className="max-w-[70ch] text-sm text-muted">
        Each business unit&apos;s approval route. Department HOD and the L&amp;D Team always approve; switch the BU Admin or HR Head step off to skip it for that
        unit. Changes apply to the next approval. Requests already waiting at a step stay there.
      </p>
      {units.map((u) => (
        <FlowCard key={u.id} unit={u} readOnly={isDemoUser(user)} />
      ))}
    </div>
  );
}
