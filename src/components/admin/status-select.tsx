"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/field";

/** Users list filter; changes the URL (?status=…) so the server renders the filtered list. */
export function StatusSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <NativeSelect
      aria-label="Show"
      name="status"
      value={value}
      className="h-9 w-48 text-[13px]"
      onChange={(e) => {
        const next = new URLSearchParams(sp);
        if (e.target.value === "all") next.delete("status");
        else next.set("status", e.target.value);
        router.push(`${pathname}?${next}`);
      }}
    >
      <option value="all">Everyone</option>
      <option value="signed-in">Signed in</option>
      <option value="not-signed-in">Not signed in yet</option>
      <option value="left">No longer in Microsoft 365</option>
    </NativeSelect>
  );
}
