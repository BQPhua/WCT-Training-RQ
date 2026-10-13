"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function exec(p: Promise<ActionResult>, success: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  }
  return { busy, exec };
}
