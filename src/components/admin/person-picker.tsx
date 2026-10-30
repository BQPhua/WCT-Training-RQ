"use client";
import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { searchPeopleAction } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";

export interface PickedPerson {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

/**
 * Type-to-search person picker (ARIA combobox). Searches the synced staff list on the server
 * after 2 characters (at most 10 results), so the browser never receives the whole company.
 */
export function PersonPicker({
  value,
  onChange,
  label,
  placeholder = "Type a name or email…",
  exclude = [],
  disabled,
  id,
}: {
  value: PickedPerson | null;
  onChange: (p: PickedPerson | null) => void;
  /** Accessible name, e.g. "Add BU Admin to Land". */
  label: string;
  placeholder?: string;
  exclude?: string[];
  disabled?: boolean;
  id?: string;
}) {
  const autoId = React.useId();
  const inputId = id ?? `pp-${autoId}`;
  const listId = `${inputId}-list`;
  const [text, setText] = React.useState(value?.name ?? "");
  const [results, setResults] = React.useState<PickedPerson[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const seq = React.useRef(0);

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Who was chosen before the user started typing: restored if they leave without picking. */
  const beforeEdit = React.useRef<PickedPerson | null>(null);

  // When the parent changes the chosen person (e.g. clears it after "Add"), show that in the box.
  const [shown, setShown] = React.useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value?.name ?? "");
  }

  /** Debounced server search, started from typing (never from an effect). */
  const search = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    const term = raw.trim();
    const n = ++seq.current;
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const found = (await searchPeopleAction(term)).filter((p) => !exclude.includes(p.id));
      if (n !== seq.current) return; // a newer search has started
      setResults(found);
      setActive(-1); // nothing highlighted until the first arrow key
      setOpen(true);
      setLoading(false);
    }, 200);
  };

  /** Our own changes update `shown` too, so only outside changes (e.g. "Add" clearing it) reset the text. */
  const emit = (p: PickedPerson | null) => {
    setShown(p);
    onChange(p);
  };

  const pick = (p: PickedPerson) => {
    beforeEdit.current = null;
    emit(p);
    setText(p.name);
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={inputId}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && results[active] ? `${listId}-${results[active].id}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (value) {
            beforeEdit.current = value;
            emit(null);
          }
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
          } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            // Leaving without picking: put back the person chosen before (or drop stray text), so a
            // half-typed name never silently removes someone, e.g. a department's HOD.
            if (!value && text.trim()) {
              const prev = beforeEdit.current;
              beforeEdit.current = null;
              if (prev) emit(prev);
              setText(prev?.name ?? "");
            }
          }, 120)
        }
        className="field-control h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-9 text-[15px] text-ink shadow-[inset_0_1px_1px_oklch(0.22_0.045_268/0.04)] outline-none placeholder:text-muted hover:border-ink-2/40 focus-visible:border-focus focus-visible:ring-[3px] focus-visible:ring-focus/25 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      />
      {loading ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
      ) : (
        text && (
          <button
            type="button"
            aria-label="Clear"
            disabled={disabled}
            onClick={() => {
              beforeEdit.current = null;
              setText("");
              emit(null);
              search("");
            }}
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted hover:bg-ink/5 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-md">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted" role="presentation">
              No one found. People appear after the nightly Microsoft 365 sync or their first sign-in.
            </li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-md px-3 py-2", i === active && "bg-info-soft")}
              >
                <span className="block text-sm font-medium text-ink">{p.name}</span>
                <span className="block truncate text-xs text-muted">
                  {p.email}
                  {p.department ? ` · ${p.department}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
