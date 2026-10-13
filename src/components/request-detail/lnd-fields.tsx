"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateLndFieldsAction } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";

export function LndFieldsForm({
  requestId,
  version,
  initial,
}: {
  requestId: string;
  version: number;
  initial: { hrdcClaimable: boolean | null; hrdcGrantNo: string | null; lndRemarks: string | null };
}) {
  const router = useRouter();
  const [claim, setClaim] = React.useState(initial.hrdcClaimable === null ? "" : initial.hrdcClaimable ? "yes" : "no");
  const [grant, setGrant] = React.useState(initial.hrdcGrantNo ?? "");
  const [notes, setNotes] = React.useState(initial.lndRemarks ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await updateLndFieldsAction(requestId, version, {
      hrdcClaimable: claim === "" ? null : claim === "yes",
      hrdcGrantNo: grant || null,
      lndRemarks: notes || null,
    });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      router.refresh();
      return;
    }
    toast.success("L&D details saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="HRD Corp claimable" htmlFor="hrdc">
          <NativeSelect id="hrdc" value={claim} onChange={(e) => setClaim(e.target.value)}>
            <option value="">Not assessed</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </NativeSelect>
        </Field>
        <Field label="Grant / application no." htmlFor="grant">
          <Input id="grant" value={grant} maxLength={50} onChange={(e) => setGrant(e.target.value)} disabled={claim !== "yes"} />
        </Field>
      </div>
      <Field label="L&D remarks" htmlFor="lndRemarks">
        <Textarea id="lndRemarks" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save L&amp;D details
        </Button>
      </div>
    </form>
  );
}
