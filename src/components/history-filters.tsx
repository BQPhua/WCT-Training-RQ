"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/field";
import { STATUS_LABEL, STATUSES } from "@/lib/workflow";

export function HistoryFilters({ bus, departments, showOrg = true }: { bus: { id: string; name: string }[]; departments: { id: string; name: string; buId: string }[]; showOrg?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(sp.get("q") ?? "");

  function update(patch: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) update({ q });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const buId = sp.get("buId") ?? "";
  const depts = buId ? departments.filter((d) => d.buId === buId) : departments;
  const active = ["status", "buId", "departmentId", "type", "from", "to", "hrdc", "q"].some((k) => sp.get(k));

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-line px-4 py-4 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.6fr)_repeat(3,minmax(0,1fr))]">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input aria-label="Search" placeholder="Ref no., title, requester, candidate, provider…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <NativeSelect aria-label="Status" value={sp.get("status") ?? ""} onChange={(e) => update({ status: e.target.value })}>
        <option value="">All statuses</option>
        <option value="OPEN">All open</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
      {showOrg && (
        <>
          <NativeSelect aria-label="Business unit" value={buId} onChange={(e) => update({ buId: e.target.value, departmentId: "" })}>
            <option value="">All business units</option>
            {bus.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Department" value={sp.get("departmentId") ?? ""} onChange={(e) => update({ departmentId: e.target.value })}>
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </>
      )}
      <NativeSelect aria-label="Training type" value={sp.get("type") ?? ""} onChange={(e) => update({ type: e.target.value })}>
        <option value="">Planned &amp; ad hoc</option>
        <option value="PLANNED">Planned</option>
        <option value="ADHOC">Ad hoc</option>
      </NativeSelect>
      <NativeSelect aria-label="HRD Corp" value={sp.get("hrdc") ?? ""} onChange={(e) => update({ hrdc: e.target.value })}>
        <option value="">HRD Corp: any</option>
        <option value="yes">HRD Corp claimable</option>
        <option value="no">Not claimable</option>
      </NativeSelect>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 lg:col-span-2">
        <Input type="date" aria-label="Training from" value={sp.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
        <span className="text-muted">–</span>
        <Input type="date" aria-label="Training to" value={sp.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
      </div>
      {active && (
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
          className="justify-self-start"
        >
          <RotateCcw /> Clear filters
        </Button>
      )}
    </div>
  );
}
