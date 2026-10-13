"use client";
import * as React from "react";
import { Plus, RotateCw } from "lucide-react";
import { createUserAction, retryNotificationAction, updateUserAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { useAdminAction } from "./use-admin-action";

type Dept = { id: string; name: string };

export function UserDeptSelect({ userId, value, depts }: { userId: string; value: string | null; depts: Dept[] }) {
  const { busy, exec } = useAdminAction();
  return (
    <NativeSelect aria-label="Department" disabled={busy} value={value ?? ""} onChange={(e) => exec(updateUserAction(userId, { departmentId: e.target.value || null }), "Department updated")} className="h-8 text-[13px]">
      <option value="">— None —</option>
      {depts.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </NativeSelect>
  );
}

export function UserActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const { busy, exec } = useAdminAction();
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => exec(updateUserAction(userId, { isActive: !active }), active ? "User deactivated" : "User reactivated")}>
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function AddUserDialog({ depts }: { depts: Dept[] }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [dept, setDept] = React.useState("");
  const { busy, exec } = useAdminAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a user" description="Pre-register someone (for example a new HOD) before their first sign-in. Their Microsoft account links automatically by email.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await exec(createUserAction({ email, name, departmentId: dept || null }), "User added")) {
              setOpen(false);
              setEmail("");
              setName("");
            }
          }}
        >
          <Field label="Work email" htmlFor="u-email" required>
            <Input id="u-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@wct.my" />
          </Field>
          <Field label="Full name" htmlFor="u-name" required>
            <Input id="u-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Department" htmlFor="u-dept">
            <NativeSelect id="u-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">— None —</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={busy}>
              Add user
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RetryButton({ id }: { id: string }) {
  const { busy, exec } = useAdminAction();
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => exec(retryNotificationAction(id), "Retry attempted")}>
      <RotateCw /> Retry
    </Button>
  );
}
