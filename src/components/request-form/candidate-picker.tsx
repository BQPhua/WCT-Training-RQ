"use client";
import * as React from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_PATH } from "@/lib/env";
import { Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/misc";

export interface CandidateRow {
  key: string;
  name: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  staffNo?: string;
  userId?: string;
  manual?: boolean;
}

interface Person {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  department?: string;
}

const MAX = 8;
const uid = () => Math.random().toString(36).slice(2, 10);

export function CandidatePicker({
  value,
  onChange,
  error,
}: {
  value: CandidateRow[];
  onChange: (rows: CandidateRow[]) => void;
  error?: string;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Person[]>([]);
  const [source, setSource] = React.useState<"graph" | "local">("graph");
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const full = value.length >= MAX;

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_PATH}/api/directory?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          const json = (await res.json()) as { people: Person[]; source: "graph" | "local" };
          setResults(json.people);
          setSource(json.source);
          setActive(0);
          setOpen(true);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const already = (p: Person) => value.some((c) => c.email && c.email.toLowerCase() === p.email.toLowerCase());

  function add(p: Person) {
    if (full || already(p)) return;
    onChange([...value, { key: uid(), name: p.name, email: p.email, jobTitle: p.jobTitle, department: p.department }]);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  function addManual() {
    if (full) return;
    onChange([...value, { key: uid(), name: q.trim(), manual: true }]);
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      add(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search staff by name or email"
          placeholder={full ? "Maximum of 8 candidates reached" : "Search staff by name or email…"}
          disabled={full}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
        {open && q.trim().length >= 2 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-md">
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {results.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={already(p)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2",
                    i === active && "bg-ink/5",
                    already(p) && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Avatar name={p.name} className="size-7 text-[11px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[p.jobTitle, p.department, p.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {already(p) && <span className="ml-auto text-xs text-muted">Added</span>}
                </li>
              ))}
              {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No staff found for “{q}”.</li>}
            </ul>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addManual();
              }}
              className="flex w-full cursor-pointer items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm text-brand-text hover:bg-ink/5"
            >
              <UserPlus className="size-4" /> Add “{q.trim()}” manually
            </button>
            {source === "local" && <p className="border-t border-line bg-surface-2 px-3 py-1.5 text-[11px] text-muted">Directory search is offline; showing staff known to this system.</p>}
          </div>
        )}
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Proposed candidates">
        {Array.from({ length: MAX }).map((_, i) => {
          const c = value[i];
          return (
            <li
              key={c?.key ?? `slot-${i}`}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2",
                c ? "border-line bg-surface" : "border-dashed border-line-strong/70 bg-transparent",
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold tabular text-muted">{i + 1}</span>
              {c ? (
                <>
                  <div className="min-w-0 flex-1">
                    {c.manual ? (
                      <div className="grid gap-1.5 sm:grid-cols-[1fr_7rem]">
                        <Input
                          aria-label={`Candidate ${i + 1} name`}
                          value={c.name}
                          placeholder="Full name"
                          onChange={(e) => onChange(value.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))}
                          className="h-8"
                        />
                        <Input
                          aria-label={`Candidate ${i + 1} staff number`}
                          value={c.staffNo ?? ""}
                          placeholder="Staff no."
                          onChange={(e) => onChange(value.map((x) => (x.key === c.key ? { ...x, staffNo: e.target.value } : x)))}
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <>
                        <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{[c.jobTitle, c.department].filter(Boolean).join(" · ") || c.email}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x.key !== c.key))}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-danger"
                    aria-label={`Remove ${c.name || `candidate ${i + 1}`}`}
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-muted/80">{i === value.length ? "Next candidate" : "Empty"}</span>
              )}
            </li>
          );
        })}
      </ol>
      {error && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
