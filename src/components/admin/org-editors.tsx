"use client";
import * as React from "react";
import { Pencil, Plus, X } from "lucide-react";
import { saveBuAdminsAction, saveBusinessUnitAction, saveDepartmentAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { useAdminAction } from "./use-admin-action";

export type UserOpt = { id: string; name: string; email: string };

export function UserSelect({ users, value, onChange, id, placeholder = "Select a person…" }: { users: UserOpt[]; value: string; onChange: (v: string) => void; id?: string; placeholder?: string }) {
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} — {u.email}
        </option>
      ))}
    </NativeSelect>
  );
}

type BuValues = { id: string; code: string; name: string; isActive: boolean };

export function BuDialog({ bu }: { bu?: BuValues }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {bu ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${bu.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> Add business unit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={bu ? `Edit ${bu.name}` : "Add business unit"}>
        {/* Mounted only while open, so every opening starts from the saved values. */}
        <BuForm bu={bu} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BuForm({ bu, onSaved }: { bu?: BuValues; onSaved: () => void }) {
  const [code, setCode] = React.useState(bu?.code ?? "");
  const [name, setName] = React.useState(bu?.name ?? "");
  const [active, setActive] = React.useState(bu?.isActive ?? true);
  const { busy, exec } = useAdminAction();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await exec(saveBusinessUnitAction({ id: bu?.id, code, name, isActive: active }), "Business unit saved")) onSaved();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Code" htmlFor="bu-code" required>
          <Input id="bu-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={12} />
        </Field>
        <Field label="Name" htmlFor="bu-name" required>
          <Input id="bu-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function BuAdminsEditor({ buId, current, users }: { buId: string; current: UserOpt[]; users: UserOpt[] }) {
  const [pick, setPick] = React.useState("");
  const { busy, exec } = useAdminAction();
  const ids = current.map((c) => c.id);
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-1.5">
        {current.length === 0 && <li className="text-sm text-returned-text">No BU Admin — nobody will be informed.</li>}
        {current.map((u) => (
          <li key={u.id} className="inline-flex items-center gap-1 rounded-full bg-ground py-1 pl-2.5 pr-1 text-sm">
            {u.name}
            <button
              type="button"
              className="grid size-5 cursor-pointer place-items-center rounded-full text-muted hover:bg-ink/10 hover:text-danger"
              aria-label={`Remove ${u.name}`}
              disabled={busy}
              onClick={() => exec(saveBuAdminsAction(buId, ids.filter((i) => i !== u.id)), "BU Admins updated")}
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <UserSelect users={users.filter((u) => !ids.includes(u.id))} value={pick} onChange={setPick} placeholder="Add BU Admin…" />
        <Button
          variant="outline"
          disabled={!pick || busy}
          onClick={async () => {
            if (await exec(saveBuAdminsAction(buId, [...ids, pick]), "BU Admin added")) setPick("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function DeptDialog({
  dept,
  bus,
  users,
}: {
  dept?: { id: string; name: string; businessUnitId: string; hodUserId: string | null; isActive: boolean };
  bus: { id: string; name: string }[];
  users: UserOpt[];
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(dept?.name ?? "");
  const [buId, setBuId] = React.useState(dept?.businessUnitId ?? bus[0]?.id ?? "");
  const [hod, setHod] = React.useState(dept?.hodUserId ?? "");
  const [active, setActive] = React.useState(dept?.isActive ?? true);
  const { busy, exec } = useAdminAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {dept ? (
          <Button variant="ghost" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button variant="primary" size="sm">
            <Plus /> Add department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={dept ? `Edit ${dept.name}` : "Add department"} description="The HOD approves every request raised in this department.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await exec(saveDepartmentAction({ id: dept?.id, name, businessUnitId: buId, hodUserId: hod || null, isActive: active }), "Department saved")) setOpen(false);
          }}
        >
          <Field label="Department name" htmlFor="d-name" required hint="Match the Microsoft 365 'Department' value so staff are mapped automatically.">
            <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Business unit" htmlFor="d-bu" required>
            <NativeSelect id="d-bu" value={buId} onChange={(e) => setBuId(e.target.value)}>
              {bus.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Head of department (HOD)" htmlFor="d-hod">
            <UserSelect id="d-hod" users={users} value={hod} onChange={setHod} placeholder="No HOD assigned" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={busy}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
