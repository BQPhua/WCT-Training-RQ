import { RoleEditor } from "@/components/admin/role-editor";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/current-user";
import { adminOverview, userOptions } from "@/lib/services/admin";
import type { RoleName } from "@/lib/workflow";

export const metadata = { title: "Admin · Roles" };

const ROLES: { role: RoleName; title: string; description: string }[] = [
  { role: "LND", title: "L&D Team", description: "Any member reviews requests after HOD approval and records HRD Corp details." },
  { role: "HR_HEAD", title: "HR Head", description: "Gives final approval. With more than one, any of them can act." },
  { role: "SYS_ADMIN", title: "System Admins", description: "Manage these settings. Can't approve unless they also hold an approver role." },
];

export default async function RolesPage() {
  const user = await requireUser();
  const [o, users] = await Promise.all([adminOverview(user), userOptions()]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {ROLES.map((r) => (
        <Panel key={r.role}>
          <PanelHeader title={r.title} description={r.description} />
          <RoleEditor role={r.role} users={users} holders={o.roles.filter((x) => x.role === r.role).map((x) => ({ id: x.userId, name: x.name, email: x.email }))} />
        </Panel>
      ))}
    </div>
  );
}
