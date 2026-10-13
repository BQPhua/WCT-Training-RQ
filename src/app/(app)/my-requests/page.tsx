import Link from "next/link";
import { Plus } from "lucide-react";
import { HistoryFilters } from "@/components/history-filters";
import { RequestsTable } from "@/components/requests-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { parseHistoryFilters, searchHistory } from "@/lib/services/history";

export const metadata = { title: "My requests" };

export default async function MyRequestsPage({ searchParams }: PageProps<"/my-requests">) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = parseHistoryFilters(sp, "mine");
  const { rows, total } = await searchHistory(user, f);
  return (
    <>
      <PageHeader
        title="My requests"
        description="Requests you raised, including drafts."
        actions={
          <Button asChild variant="brand">
            <Link href="/requests/new">
              <Plus /> New request
            </Link>
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        <HistoryFilters bus={[]} departments={[]} showOrg={false} />
        <RequestsTable rows={rows} total={total} f={f} base="/my-requests" sp={sp} emptyTitle="You haven't raised any requests yet" emptyText="Start a new training request and it will appear here." />
      </Panel>
    </>
  );
}
