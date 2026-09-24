import mammoth from "mammoth";
// pdf-parse has no ESM types; import the CJS default.
// @ts-expect-error -- no types for the internal lib entry
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type SupportedUploadType = "pdf" | "docx" | "md" | "txt";

export function detectUploadType(filename: string, mimetype: string): SupportedUploadType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || mimetype === "application/pdf") return "pdf";
  if (ext === "docx" || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "md") return "md";
  if (ext === "txt" || mimetype === "text/plain") return "txt";
  return null;
}

export async function extractText(buffer: Buffer, type: SupportedUploadType): Promise<string> {
  switch (type) {
    case "pdf": {
      const result = await pdfParse(buffer);
      return (result.text as string).trim();
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }
    case "md":
    case "txt":
      return buffer.toString("utf-8").trim();
  }
}
