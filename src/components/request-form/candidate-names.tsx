"use client";
import { Input } from "@/components/ui/field";

export const MAX_CANDIDATES = 8;

/** Eight optional name boxes, typed by hand (the WCT staff list isn't available yet). */
export function CandidateNames({ value, onChange, error }: { value: string[]; onChange: (names: string[]) => void; error?: string }) {
  const slots = Array.from({ length: MAX_CANDIDATES }, (_, i) => value[i] ?? "");
  const update = (i: number, name: string) => {
    const next = [...slots];
    next[i] = name;
    // Keep the order the user typed, without gaps at the end.
    let end = next.length;
    while (end > 0 && !next[end - 1].trim()) end--;
    onChange(next.slice(0, end));
  };
  return (
    <div>
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {slots.map((name, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <label htmlFor={`candidate-${i + 1}`} className="w-5 shrink-0 text-right text-xs tabular text-muted">
              {i + 1}
            </label>
            <Input
              id={`candidate-${i + 1}`}
              value={name}
              maxLength={120}
              autoComplete="off"
              placeholder="Full name"
              onChange={(e) => update(i, e.target.value)}
              aria-invalid={!!error && i === 0}
              aria-label={`Candidate ${i + 1} name`}
            />
          </li>
        ))}
      </ol>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
