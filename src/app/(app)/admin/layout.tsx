import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { isDemoUser, isSystemAdmin } from "@/lib/auth/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isSystemAdmin(user)) redirect("/dashboard?denied=1");
  return (
    <>
      <PageHeader title="Admin settings" description="Who approves what. Changes apply to the next action on every request." />
      {isDemoUser(user) && (
        <p role="note" className="mb-4 rounded-lg bg-pending-soft px-4 py-3 text-sm text-pending-text">
          Demo account: you can look around these settings, but changes are turned off. Only demo accounts are listed.
        </p>
      )}
      <AdminNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
