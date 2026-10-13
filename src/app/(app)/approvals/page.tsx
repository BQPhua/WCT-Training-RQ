import { RequestsTable } from "@/components/requests-table";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { parseHistoryFilters, searchHistory } from "@/lib/services/history";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = parseHistoryFilters({ sort: "submittedAt", dir: "asc", ...sp }, "approvals");
  const { rows, total } = await searchHistory(user, f);
  return (
    <>
      <PageHeader title="Approvals" description="Requests waiting for your decision, oldest first." />
      <Panel className="overflow-hidden">
        <RequestsTable rows={rows} total={total} f={f} base="/approvals" sp={sp} emptyTitle="You're all caught up" emptyText="Nothing is waiting for your approval." />
      </Panel>
    </>
  );
}
