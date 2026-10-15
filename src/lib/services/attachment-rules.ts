export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type AttachmentKind = "SUPPORTING" | "NAME_LIST";

export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export const ACCEPT_ATTR = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";

/** Participant name list (used instead of typed names when there are more than 8 people). */
export const NAME_LIST_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};
export const NAME_LIST_ACCEPT_ATTR = ".xlsx,.xls,.csv";

export function mimeTypeFor(ext: string, kind: AttachmentKind): string {
  return (kind === "NAME_LIST" ? NAME_LIST_TYPES : ALLOWED_TYPES)[ext];
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** Basename only, no control chars or path separators, max 120 chars (keeps extension). */
export function sanitizeFilename(name: string): string {
  let base = name.split(/[\\/]/).pop() ?? "";
  base = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\.+/, "").trim();
  if (!base) return "file";
  if (base.length > 120) {
    const ext = extensionOf(base);
    base = ext ? `${base.slice(0, 119 - ext.length)}.${ext}` : base.slice(0, 120);
  }
  return base;
}

/**
 * `existingCount` is the number of supporting documents already attached; it is
 * ignored for a name list, which replaces any previous one.
 */
export function validateUpload(
  file: { name: string; size: number },
  existingCount: number,
  kind: AttachmentKind = "SUPPORTING",
): string | null {
  if (kind === "NAME_LIST") {
    if (!NAME_LIST_TYPES[extensionOf(file.name)]) return "Name list must be an Excel or CSV file";
  } else {
    if (existingCount >= MAX_ATTACHMENTS) return `Maximum ${MAX_ATTACHMENTS} attachments`;
    if (!ALLOWED_TYPES[extensionOf(file.name)]) return "File type not allowed";
  }
  if (file.size <= 0) return "File is empty";
  if (file.size > MAX_ATTACHMENT_BYTES) return "File exceeds 5 MB";
  return null;
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** Verify file content (magic bytes) matches the claimed extension. */
export function sniffOk(ext: string, bytes: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "docx":
    case "xlsx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // ZIP container
    case "xls":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]); // OLE2 compound file
    case "csv":
      return !bytes.subarray(0, 4096).includes(0); // plain text: no NUL bytes
    default:
      return false;
  }
}

/** RFC 6266/5987 Content-Disposition with an ASCII fallback. */
export function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
