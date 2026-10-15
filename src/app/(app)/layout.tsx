import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/current-user";
import { countAwaiting } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { LND: "L&D Team", HR_HEAD: "HR Head", SYS_ADMIN: "System Admin" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const approvals = await countAwaiting(user);
  const roles = [
    ...(user.actor.hodDepartmentIds.length ? ["Dept HOD"] : []),
    ...(user.actor.buAdminBusinessUnitIds.length ? ["BU Admin"] : []),
    ...user.actor.roles.map((r) => ROLE_LABEL[r]),
  ];
  return (
    <AppShell
      user={{ name: user.name, email: user.email, jobTitle: user.jobTitle, department: user.department?.name ?? null, roles }}
      nav={{ approvals, isAdmin: user.actor.roles.includes("SYS_ADMIN") }}
    >
      {children}
    </AppShell>
  );
}
