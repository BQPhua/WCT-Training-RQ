import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth/current-user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("SYS_ADMIN");
  return (
    <>
      <PageHeader title="Admin settings" description="Who approves what. Changes apply to the next action on every request." />
      <AdminNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
