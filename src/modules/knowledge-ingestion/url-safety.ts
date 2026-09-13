import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

import { MAX_EXTRACTED_TEXT_CHARS, MAX_SOURCE_BYTES } from "./extractors";

const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_URL_RESPONSE_BYTES = MAX_SOURCE_BYTES;

export type ResolveHostname = (hostname: string) => Promise<string[]>;

export type SafeFetchResponse = {
  status: number;
  headers: Headers;
  body: Uint8Array;
};

export type SafeFetch = (
  url: string,
  options?: { resolvedAddresses?: string[] },
) => Promise<SafeFetchResponse>;

export type SafeKnowledgeUrlResult = {
  canonicalUrl: string;
  text: string;
  bytes: Uint8Array;
  contentType: string;
};

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split(".").map(Number);
}

function isUnsafeIpv4(address: string): boolean {
  const parts = ipv4Parts(address);
  if (!parts) return false;
  const [a = 0, b = 0] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function normalizedIpv6(address: string): string {
  return address.toLowerCase().replace(/^\[|\]$/g, "");
}

function isUnsafeIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  const value = normalizedIpv6(address);

  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;

  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isUnsafeIpv4(mapped[1]!) : false;
}

function isUnsafeAddress(address: string): boolean {
  return isUnsafeIpv4(address) || isUnsafeIpv6(address);
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function resolveAndValidateUrl(
  rawUrl: string,
  resolveHostname: ResolveHostname,
): Promise<{ canonicalUrl: string; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Unsupported or unsafe knowledge source URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported knowledge source URL protocol.");
  }
  if (url.username || url.password) {
    throw new Error("Unsafe knowledge source URL credentials.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Unsafe knowledge source URL destination.");
  }

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = await resolveHostname(hostname);
    } catch {
      throw new Error("Knowledge source hostname could not be resolved safely.");
    }
  }

  if (addresses.length === 0 || addresses.some((address) => !isIP(address) || isUnsafeAddress(address))) {
    throw new Error("Unsafe knowledge source URL destination.");
  }

  url.hash = "";
  return { canonicalUrl: url.toString(), addresses };
}

export async function validateKnowledgeSourceUrl(
  rawUrl: string,
  resolveHostname: ResolveHostname = defaultResolveHostname,
): Promise<string> {
  return (await resolveAndValidateUrl(rawUrl, resolveHostname)).canonicalUrl;
}

function headersFromIncomingMessage(headers: http.IncomingHttpHeaders): Headers {
  const output = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) output.append(name, item);
    } else if (value !== undefined) {
      output.set(name, value);
    }
  }
  return output;
}

function pinnedFetch(urlString: string, addresses: string[]): Promise<SafeFetchResponse> {
  const url = new URL(urlString);
  const address = addresses[0];
  if (!address) throw new Error("Knowledge source has no safe network destination.");

  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: url.protocol === "https:" ? url.hostname : undefined,
        rejectUnauthorized: true,
        headers: {
          Host: url.host,
          Accept: "text/html,text/plain,application/xhtml+xml",
          "User-Agent": "PAK-Knowledge-Ingestion/1.0",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let total = 0;

        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.byteLength;
          if (total > MAX_URL_RESPONSE_BYTES) {
            request.destroy(new Error("Knowledge URL response is too large."));
            return;
          }
          chunks.push(buffer);
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: headersFromIncomingMessage(response.headers),
            body: new Uint8Array(Buffer.concat(chunks)),
          });
        });
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Knowledge URL request timed out."));
    });
    request.on("error", reject);
    request.end();
  });
}

const defaultFetcher: SafeFetch = (url, options) => pinnedFetch(url, options?.resolvedAddresses ?? []);

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, token: string) => {
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const code = Number.parseInt(token.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (token.startsWith("#")) {
      const code = Number.parseInt(token.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[token.toLowerCase()] ?? match;
  });
}

function sanitizeHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<(script|style|noscript|template|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePlainText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function fetchSafeKnowledgeUrl(
  rawUrl: string,
  dependencies: {
    resolveHostname?: ResolveHostname;
    fetcher?: SafeFetch;
  } = {},
): Promise<SafeKnowledgeUrlResult> {
  const resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname;
  const fetcher = dependencies.fetcher ?? defaultFetcher;
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const validated = await resolveAndValidateUrl(currentUrl, resolveHostname);
    const response = await fetcher(validated.canonicalUrl, {
      resolvedAddresses: validated.addresses,
    });

    if (isRedirect(response.status)) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Knowledge source redirected too many times.");
      }
      const location = response.headers.get("location");
      if (!location) throw new Error("Knowledge source redirect is missing a destination.");
      currentUrl = new URL(location, validated.canonicalUrl).toString();
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error("Knowledge source could not be fetched safely.");
    }
    if (response.body.byteLength === 0) {
      throw new Error("Knowledge source contains no usable text.");
    }
    if (response.body.byteLength > MAX_URL_RESPONSE_BYTES) {
      throw new Error("Knowledge URL response is too large.");
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_URL_RESPONSE_BYTES) {
      throw new Error("Knowledge URL response is too large.");
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
    if (!["text/html", "text/plain", "application/xhtml+xml"].includes(contentType)) {
      throw new Error("Unsupported knowledge URL content type.");
    }

    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
    } catch {
      throw new Error("Knowledge URL response is not valid UTF-8 text.");
    }

    const text = contentType === "text/plain" ? sanitizePlainText(decoded) : sanitizeHtml(decoded);
    if (!text) throw new Error("Knowledge source contains no usable text.");
    if (text.length > MAX_EXTRACTED_TEXT_CHARS) {
      throw new Error("Extracted text is too large.");
    }

    return {
      canonicalUrl: validated.canonicalUrl,
      text,
      bytes: response.body,
      contentType,
    };
  }

  throw new Error("Knowledge source could not be fetched safely.");
}
