"use client";
import * as React from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BASE_PATH } from "@/lib/env";
import { ACCEPT_ATTR, MAX_ATTACHMENTS } from "@/lib/services/attachment-rules";

export interface AttachmentItem {
  id: string;
  originalName: string;
  sizeBytes: number;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentField({
  items,
  onChange,
  ensureSaved,
}: {
  items: AttachmentItem[];
  onChange: (items: AttachmentItem[]) => void;
  /** Saves the draft if needed and returns its id. */
  ensureSaved: () => Promise<string | null>;
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const id = await ensureSaved();
      if (!id) return;
      let current = items;
      for (const file of Array.from(files)) {
        if (current.length >= MAX_ATTACHMENTS) {
          toast.error(`Maximum ${MAX_ATTACHMENTS} attachments`);
          break;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${BASE_PATH}/api/requests/${id}/attachments`, { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          toast.error(`${file.name}: ${json.error ?? "Upload failed"}`);
          continue;
        }
        current = [...current, json as AttachmentItem];
        onChange(current);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(item: AttachmentItem) {
    const res = await fetch(`${BASE_PATH}/api/attachments/${item.id}`, { method: "DELETE" });
    if (res.ok) onChange(items.filter((i) => i.id !== item.id));
    else toast.error("Couldn't remove the attachment.");
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-lg border border-line">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted" />
              <a href={`${BASE_PATH}/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">
                {a.originalName}
              </a>
              <span className="text-xs tabular text-muted">{formatBytes(a.sizeBytes)}</span>
              <button type="button" onClick={() => remove(a)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-danger" aria-label={`Remove ${a.originalName}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-5 text-center transition-colors hover:border-brand hover:bg-brand-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-muted" /> : <Paperclip className="size-5 text-muted" />}
        <span className="text-sm font-medium text-ink">{busy ? "Uploading…" : "Attach brochure or quotation"}</span>
        <span className="text-xs text-muted">PDF, Word, Excel or image · up to 10 MB each · max {MAX_ATTACHMENTS}</span>
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy || items.length >= MAX_ATTACHMENTS} />
      </label>
    </div>
  );
}
