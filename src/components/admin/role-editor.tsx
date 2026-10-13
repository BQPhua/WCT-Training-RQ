"use client";
import * as React from "react";
import { X } from "lucide-react";
import { assignRoleAction, revokeRoleAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import type { RoleName } from "@/lib/workflow";
import { UserSelect, type UserOpt } from "./org-editors";
import { useAdminAction } from "./use-admin-action";

export function RoleEditor({ role, holders, users }: { role: RoleName; holders: UserOpt[]; users: UserOpt[] }) {
  const [pick, setPick] = React.useState("");
  const { busy, exec } = useAdminAction();
  return (
    <div>
      <ul className="divide-y divide-line">
        {holders.length === 0 && <li className="px-5 py-3 text-sm text-returned-text">Nobody holds this role yet.</li>}
        {holders.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-5 py-2.5">
            <Avatar name={h.name} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{h.name}</span>
              <span className="block truncate text-xs text-muted">{h.email}</span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${h.name}`} disabled={busy} onClick={() => exec(revokeRoleAction(h.id, role), "Role removed")}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line px-5 py-3">
        <UserSelect users={users.filter((u) => !holders.some((h) => h.id === u.id))} value={pick} onChange={setPick} placeholder="Add a person…" />
        <Button variant="outline" disabled={!pick || busy} onClick={async () => (await exec(assignRoleAction(pick, role), "Role assigned")) && setPick("")}>
          Add
        </Button>
      </div>
    </div>
  );
}
