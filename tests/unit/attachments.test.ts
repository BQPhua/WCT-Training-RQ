import { describe, expect, it } from "vitest";
import { contentDisposition, sanitizeFilename, sniffOk, validateUpload } from "@/lib/services/attachment-rules";

const MB = 1024 * 1024;

describe("sanitizeFilename", () => {
  it("drops directories and traversal", () => {
    expect(sanitizeFilename("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFilename("C:\\Users\\me\\quote.pdf")).toBe("quote.pdf");
  });
  it("removes control characters and limits length to 120", () => {
    expect(sanitizeFilename("a\u0000b\u001f.pdf")).toBe("ab.pdf");
    expect(sanitizeFilename(`${"x".repeat(200)}.pdf`).length).toBe(120);
    expect(sanitizeFilename(`${"x".repeat(200)}.pdf`).endsWith(".pdf")).toBe(true);
  });
  it("falls back to 'file' when nothing is left", () => {
    expect(sanitizeFilename("../")).toBe("file");
  });
});

describe("validateUpload", () => {
  it("accepts an allowed file", () => {
    expect(validateUpload({ name: "brochure.pdf", size: 2 * MB }, 0)).toBeNull();
  });
  it("rejects files over 5 MB", () => {
    expect(validateUpload({ name: "big.pdf", size: 5 * MB + 1 }, 0)).toBe("File exceeds 5 MB");
    expect(validateUpload({ name: "ok.pdf", size: 5 * MB }, 0)).toBeNull();
  });
  it("name lists accept Excel and CSV only", () => {
    expect(validateUpload({ name: "names.csv", size: 10 }, 0, "NAME_LIST")).toBeNull();
    expect(validateUpload({ name: "names.xls", size: 10 }, 0, "NAME_LIST")).toBeNull();
    expect(validateUpload({ name: "names.xlsx", size: 10 }, 0, "NAME_LIST")).toBeNull();
    expect(validateUpload({ name: "names.pdf", size: 10 }, 0, "NAME_LIST")).toBe("Name list must be an Excel or CSV file");
    expect(validateUpload({ name: "names.csv", size: 10 }, 0, "SUPPORTING")).toBe("File type not allowed");
    expect(validateUpload({ name: "virus.exe", size: 10 }, 0, "NAME_LIST")).toBe("Name list must be an Excel or CSV file");
  });
  it("name list size limit is 5 MB and it does not count towards the 5 attachments", () => {
    expect(validateUpload({ name: "names.xlsx", size: 5 * MB + 1 }, 0, "NAME_LIST")).toBe("File exceeds 5 MB");
    expect(validateUpload({ name: "names.xlsx", size: 10 }, 5, "NAME_LIST")).toBeNull();
  });
  it("rejects disallowed types", () => {
    expect(validateUpload({ name: "virus.exe", size: 10 }, 0)).toBe("File type not allowed");
    expect(validateUpload({ name: "noext", size: 10 }, 0)).toBe("File type not allowed");
  });
  it("rejects the 6th attachment", () => {
    expect(validateUpload({ name: "a.pdf", size: 10 }, 5)).toBe("Maximum 5 attachments");
  });
  it("rejects empty files", () => {
    expect(validateUpload({ name: "a.pdf", size: 0 }, 0)).toBe("File is empty");
  });
});

describe("sniffOk (magic bytes)", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);
  it("checks content matches the extension", () => {
    expect(sniffOk("pdf", new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(sniffOk("png", bytes(0x89, 0x50, 0x4e, 0x47))).toBe(true);
    expect(sniffOk("jpg", bytes(0xff, 0xd8, 0xff))).toBe(true);
    expect(sniffOk("docx", bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
    expect(sniffOk("pdf", new TextEncoder().encode("MZ\x90 not a pdf"))).toBe(false);
    expect(sniffOk("xls", bytes(0xd0, 0xcf, 0x11, 0xe0))).toBe(true);
    expect(sniffOk("csv", new TextEncoder().encode("Name,Department\nAli,QS\n"))).toBe(true);
    expect(sniffOk("csv", new Uint8Array([0x41, 0x00, 0x42]))).toBe(false);
  });
});

describe("contentDisposition", () => {
  it("encodes non-ASCII names safely", () => {
    const h = contentDisposition("attachment", 'Résumé "final".pdf');
    expect(h).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9");
    expect(h).not.toContain('"final"');
  });
});
