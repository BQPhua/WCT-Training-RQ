"use client";
import * as React from "react";
import { FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Field, Input } from "@/components/ui/field";
import { BASE_PATH } from "@/lib/env";
import { NAME_LIST_ACCEPT_ATTR } from "@/lib/services/attachment-rules";
import { formatBytes, type AttachmentItem } from "./attachment-field";

/** Participant name list (Excel/CSV) used instead of typed names for groups larger than 8. */
export function NameListField({
  nameList,
  onNameListChange,
  participantCount,
  onParticipantCountChange,
  ensureSaved,
  errors,
}: {
  nameList: AttachmentItem | null;
  onNameListChange: (item: AttachmentItem | null) => void;
  participantCount: string;
  onParticipantCountChange: (value: string) => void;
  ensureSaved: () => Promise<string | null>;
  errors: { nameList?: string; participantCount?: string };
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const id = await ensureSaved();
      if (!id) return;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "NAME_LIST");
      const res = await fetch(`${BASE_PATH}/api/requests/${id}/attachments`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`${file.name}: ${json.error ?? "Upload failed"}`);
        return;
      }
      onNameListChange(json as AttachmentItem);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!nameList) return;
    const res = await fetch(`${BASE_PATH}/api/attachments/${nameList.id}`, { method: "DELETE" });
    if (res.ok) onNameListChange(null);
    else toast.error("Couldn't remove the name list.");
  }

  return (
    <div className="space-y-4">
      {nameList ? (
        <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
          <FileSpreadsheet className="size-5 shrink-0 text-approved" />
          <a href={`${BASE_PATH}/api/attachments/${nameList.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline">
            {nameList.originalName}
          </a>
          <span className="text-xs tabular text-muted">{formatBytes(nameList.sizeBytes)}</span>
          <label className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-info-text hover:bg-info-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus">
            Replace
            <input type="file" accept={NAME_LIST_ACCEPT_ATTR} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
          </label>
          <button type="button" onClick={remove} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-danger" aria-label={`Remove ${nameList.originalName}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files[0]);
          }}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-muted" /> : <Upload className="size-5 text-muted" />}
          <span className="text-sm font-medium text-ink">{busy ? "Uploading…" : "Upload participant name list"}</span>
          <span className="text-xs text-muted">Excel or CSV · up to 5 MB</span>
          <input ref={inputRef} type="file" accept={NAME_LIST_ACCEPT_ATTR} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
        </label>
      )}
      {errors.nameList && <p className="text-[13px] text-danger">{errors.nameList}</p>}
      <Field label="Number of participants" htmlFor="participantCount" required error={errors.participantCount}>
        <Input
          id="participantCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={participantCount}
          onChange={(e) => onParticipantCountChange(e.target.value)}
          aria-invalid={!!errors.participantCount}
          className="max-w-40 tabular"
        />
      </Field>
    </div>
  );
}
