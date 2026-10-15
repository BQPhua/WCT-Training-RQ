import { redirect } from "next/navigation";

/** Reports moved to the dashboard's Analytics section. */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const year = typeof sp.year === "string" ? `?year=${encodeURIComponent(sp.year)}` : "";
  redirect(`/dashboard${year}#analytics`);
}
