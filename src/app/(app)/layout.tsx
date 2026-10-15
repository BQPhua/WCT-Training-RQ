import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/current-user";
import { isDemoUser, isSystemAdmin } from "@/lib/auth/roles";
import { countAwaiting } from "@/lib/services/dashboard";
import { listDemoAccounts, roleLabelOf } from "@/lib/services/view-as";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { LND: "L&D Team (System Admin)", HR_HEAD: "HR Head", SYS_ADMIN: "System Admin" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const approvals = await countAwaiting(user);
  const roles = [
    ...(user.actor.hodDepartmentIds.length ? ["Dept HOD"] : []),
    ...(user.actor.buAdminBusinessUnitIds.length ? ["BU Admin"] : []),
    ...user.actor.roles.map((r) => ROLE_LABEL[r]),
  ];
  const demo = isDemoUser(user);
  const demoAccounts = !user.viewedBy && !demo && isSystemAdmin(user) ? await listDemoAccounts() : undefined;
  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        department: user.department?.name ?? null,
        roles,
        demoAccounts,
        viewedAs: user.viewedBy ? { name: user.name, roleLabel: roleLabelOf(user) } : null,
      }}
      nav={{ approvals, isAdmin: isSystemAdmin(user) }}
    >
      {children}
    </AppShell>
  );
}
