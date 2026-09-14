export const MAX_RESEARCH_RESULTS = 8;
export const MAX_RESEARCH_TITLE_CHARS = 500;
export const MAX_RESEARCH_URL_CHARS = 2048;
export const MAX_RESEARCH_HOST_CHARS = 255;
export const MAX_RESEARCH_EXCERPT_CHARS = 4000;
export const RESEARCH_PROVIDER_TIMEOUT_MS = 12_000;

type CanonicalResearchUrl = {
  canonicalUrl: string;
  sourceHost: string;
};

export type NormalizedResearchHit = CanonicalResearchUrl & {
  title: string;
  excerpt: string;
  retrievedAt: string;
};

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return -1;
    const value = Number.parseInt(part, 10);
    return value >= 0 && value <= 255 ? value : -1;
  });
  return octets.every((value) => value >= 0) ? octets : null;
}

function isUnsafeIpv4(host: string): boolean {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const [a, b] = octets as [number, number, number, number];

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}

function isIpv6Literal(host: string): boolean {
  return host.includes(":");
}

function isUnsafeIpv6(host: string): boolean {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!isIpv6Literal(value)) return false;

  if (value === "::" || value === "::1") return true;
  if (value.startsWith("::ffff:") || value.startsWith("::")) return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value) || /^fe[c-f]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;

  const firstGroup = value.split(":", 1)[0];
  if (!firstGroup || !/^[0-9a-f]{1,4}$/.test(firstGroup)) return true;
  const firstWord = Number.parseInt(firstGroup, 16);

  // Fail closed for literal IPv6 outside the currently routable global-unicast 2000::/3 space.
  return (firstWord & 0xe000) !== 0x2000;
}

function isUnsafeHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost")) return true;
  if (value.endsWith(".local") || value.endsWith(".internal") || value.endsWith(".lan")) return true;
  if (parseIpv4(value)) return isUnsafeIpv4(value);
  if (isIpv6Literal(value)) return isUnsafeIpv6(value);
  return false;
}

export function canonicalizeResearchUrl(rawUrl: string): CanonicalResearchUrl | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > MAX_RESEARCH_URL_CHARS) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname || url.hostname.length > MAX_RESEARCH_HOST_CHARS) return null;
  if (isUnsafeHostname(url.hostname)) return null;

  url.hash = "";
  const canonicalUrl = url.toString();
  if (canonicalUrl.length > MAX_RESEARCH_URL_CHARS) return null;

  return {
    canonicalUrl,
    sourceHost: url.hostname.toLowerCase().replace(/^\[|\]$/g, ""),
  };
}

export function extractExaTextBlocks(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const content = (raw as { content?: unknown }).content;
  if (!Array.isArray(content)) return [];

  return content.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const block = item as { type?: unknown; text?: unknown };
    return block.type === "text" && typeof block.text === "string" ? [block.text] : [];
  });
}

function providerEntries(raw: unknown): string[] {
  return extractExaTextBlocks(raw)
    .flatMap((text) => text.split(/\n\s*---\s*\n/g))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function countExaStructuredResults(raw: unknown): number {
  return providerEntries(raw).filter(
    (entry) => /^Title:\s*.+$/m.test(entry) && /^URL:\s*.+$/m.test(entry),
  ).length;
}

function field(entry: string, label: string): string | null {
  const match = entry.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || null;
}

function excerptFromEntry(entry: string): string | null {
  const highlights = entry.match(/(?:^|\n)Highlights:\s*\n([\s\S]*)$/);
  if (highlights?.[1]?.trim()) return highlights[1].trim();

  const text = entry.match(/(?:^|\n)Text:\s*([\s\S]*)$/);
  return text?.[1]?.trim() || null;
}

export function normalizeExaToolResult(raw: unknown, retrievedAt: string): NormalizedResearchHit[] {
  const seen = new Set<string>();
  const hits: NormalizedResearchHit[] = [];

  for (const entry of providerEntries(raw)) {
    if (hits.length >= MAX_RESEARCH_RESULTS) break;

    const title = field(entry, "Title");
    const rawUrl = field(entry, "URL");
    const excerpt = excerptFromEntry(entry);
    if (!title || !rawUrl || !excerpt) continue;

    const canonical = canonicalizeResearchUrl(rawUrl);
    if (!canonical || seen.has(canonical.canonicalUrl)) continue;

    seen.add(canonical.canonicalUrl);
    hits.push({
      title: title.slice(0, MAX_RESEARCH_TITLE_CHARS),
      canonicalUrl: canonical.canonicalUrl,
      sourceHost: canonical.sourceHost,
      excerpt: excerpt.slice(0, MAX_RESEARCH_EXCERPT_CHARS),
      retrievedAt,
    });
  }

  return hits;
}
