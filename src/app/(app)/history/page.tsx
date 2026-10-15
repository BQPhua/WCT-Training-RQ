import { Download } from "lucide-react";
import { HistoryFilters } from "@/components/history-filters";
import { RequestsTable } from "@/components/requests-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { BASE_PATH } from "@/lib/env";
import { parseHistoryFilters, searchHistory } from "@/lib/services/history";
import { orgOptions } from "@/lib/services/org";

export const metadata = { title: "Training RQ History" };

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = parseHistoryFilters(sp);
  const [{ rows, total }, org] = await Promise.all([searchHistory(user, f), orgOptions()]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  return (
    <>
      <PageHeader
        title="Training RQ History"
        description="Every request you're allowed to see. Search by candidate to see one employee's training history."
        actions={
          <Button asChild variant="outline">
            <a href={`${BASE_PATH}/api/export/history${qs ? `?${qs}` : ""}`}>
              <Download /> Export to Excel
            </a>
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        <HistoryFilters bus={org.bus} departments={org.departments} />
        <RequestsTable rows={rows} total={total} f={f} base="/history" sp={sp} emptyTitle="No requests match these filters" emptyText="Try a different search or clear the filters." />
      </Panel>
    </>
  );
}
