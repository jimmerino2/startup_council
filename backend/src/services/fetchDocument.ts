import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import mammoth from "mammoth";
// pdf-parse has no ESM types; import the CJS default.
// @ts-expect-error -- no types for the internal lib entry
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// The URLs come from a search provider's citations, but they are still untrusted: the server must
// never be tricked into reading internal addresses, so every hop is checked and size/time are capped.
const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
/** Cap on the extracted text kept per document. */
export const MAX_RAW_CHARS = 30_000;

export interface FetchedDocument {
  url: string;
  contentType: string;
  text: string;
  bytes: number;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, including cloud metadata endpoints
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224 // multicast and reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const l = ip.toLowerCase();
  if (l === "::1" || l === "::") return true;
  if (l.startsWith("fc") || l.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(l)) return true; // link-local
  if (l.startsWith("::ffff:")) {
    const dotted = l.slice(7);
    return isIP(dotted) === 4 ? isPrivateIPv4(dotted) : true; // hex-mapped forms: refuse
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error("Host did not resolve");
  for (const { address, family } of addresses) {
    if (family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address)) {
      throw new Error("Refusing to fetch a private or internal address");
    }
  }
}

async function readCapped(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("Document is too large");
  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Document is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function toText(buffer: Buffer, contentType: string, url: URL): Promise<string> {
  const path = url.pathname.toLowerCase();
  if (contentType.includes("application/pdf") || path.endsWith(".pdf")) {
    return ((await pdfParse(buffer)).text as string).trim();
  }
  if (contentType.includes("wordprocessingml") || path.endsWith(".docx")) {
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }
  if (contentType.includes("html")) return htmlToText(buffer.toString("utf-8"));
  if (contentType.startsWith("text/") || contentType.includes("json")) return buffer.toString("utf-8").trim();
  throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
}

/** Downloads a public web page/PDF/DOCX and returns its readable text. Throws on any problem. */
export async function fetchDocument(rawUrl: string): Promise<FetchedDocument> {
  let url = new URL(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) links can be fetched");
    if (url.username || url.password) throw new Error("Links with credentials are not allowed");
    if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Non-standard ports are not allowed");
    await assertPublicHost(url.hostname);

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "StartupCouncilClerk/1.0", Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5" },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`HTTP ${res.status} redirect without a location`);
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const buffer = await readCapped(res);
    const text = (await toText(buffer, contentType, url)).slice(0, MAX_RAW_CHARS);
    if (!text) throw new Error("No readable text in the document");
    return { url: url.toString(), contentType: contentType.split(";")[0], text, bytes: buffer.byteLength };
  }
  throw new Error("Too many redirects");
}
