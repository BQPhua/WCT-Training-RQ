"use client";
import * as React from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cloneAction } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

export function CloneButton({ requestId }: { requestId: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        setBusy(true);
        const r = await cloneAction(requestId);
        setBusy(false);
        if (r && !r.ok) toast.error(r.error);
      }}
      disabled={busy}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Copy />} Clone
    </Button>
  );
}
