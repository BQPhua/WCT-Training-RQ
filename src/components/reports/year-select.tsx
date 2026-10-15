"use client";
import { usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/field";

export function YearSelect({ year, years, hash }: { year: number; years: number[]; hash?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="w-32">
      <NativeSelect aria-label="Year" value={year} onChange={(e) => router.replace(`${pathname}?year=${e.target.value}${hash ? `#${hash}` : ""}`, { scroll: false })}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
