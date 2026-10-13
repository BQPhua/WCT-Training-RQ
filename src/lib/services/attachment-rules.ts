export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export const ACCEPT_ATTR = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** Basename only, no control chars or path separators, max 120 chars (keeps extension). */
export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  let base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  base = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\.+/, "").trim();
  if (!base) return "file";
  if (base.length > 120) {
    const ext = extensionOf(base);
    base = ext ? `${base.slice(0, 119 - ext.length)}.${ext}` : base.slice(0, 120);
  }
  return base;
}

export function validateUpload(file: { name: string; size: number }, existingCount: number): string | null {
  if (existingCount >= MAX_ATTACHMENTS) return `Maximum ${MAX_ATTACHMENTS} attachments`;
  if (!ALLOWED_TYPES[extensionOf(file.name)]) return "File type not allowed";
  if (file.size <= 0) return "File is empty";
  if (file.size > MAX_ATTACHMENT_BYTES) return "File exceeds 10 MB";
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
    default:
      return false;
  }
}

/** RFC 6266/5987 Content-Disposition with an ASCII fallback. */
export function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
