import { describe, expect, it } from "vitest";

import {
  canonicalizeResearchUrl,
  normalizeExaToolResult,
} from "../../../supabase/functions/knowledge-research/normalize";

const retrievedAt = "2026-09-14T01:20:00.000Z";

function textResult(entries: string[]) {
  return {
    content: [
      {
        type: "text",
        text: entries.join("\n\n---\n\n"),
      },
    ],
  };
}

function entry(index: number, url = `https://example.com/article-${index}#section`) {
  return [
    `Title: Result ${index}`,
    `URL: ${url}`,
    "Published: 2026-09-14",
    "Author: Example Author",
    `Highlights:\nUseful public excerpt ${index}.`,
  ].join("\n");
}

describe("Exa research normalization", () => {
  it("normalizes Exa text blocks, strips fragments and deduplicates canonical URLs", () => {
    const hits = normalizeExaToolResult(
      textResult([
        entry(1, "https://example.com/path#first"),
        entry(2, "https://example.com/path#second"),
      ]),
      retrievedAt,
    );

    expect(hits).toEqual([
      {
        title: "Result 1",
        canonicalUrl: "https://example.com/path",
        sourceHost: "example.com",
        excerpt: "Useful public excerpt 1.",
        retrievedAt,
      },
    ]);
  });

  it("returns at most eight bounded results", () => {
    const hits = normalizeExaToolResult(
      textResult(Array.from({ length: 12 }, (_, index) => entry(index + 1))),
      retrievedAt,
    );

    expect(hits).toHaveLength(8);
    expect(hits.every((hit) => hit.title.length <= 500)).toBe(true);
    expect(hits.every((hit) => hit.excerpt.length <= 4000)).toBe(true);
  });

  it.each([
    "notaurl",
    "ftp://example.com/file",
    "https://user:pass@example.com/private",
    "http://localhost/path",
    "http://sub.localhost/path",
    "http://127.0.0.1/path",
    "http://10.0.0.1/path",
    "http://169.254.169.254/latest/meta-data",
    "http://172.16.0.1/path",
    "http://192.168.1.1/path",
    "http://[::1]/path",
    "http://[fc00::1]/path",
    "http://[fe80::1]/path",
    "http://[2001:db8::1]/path",
    "http://[::ffff:127.0.0.1]/path",
  ])("rejects unsafe or unsupported research URL %s", (rawUrl) => {
    expect(canonicalizeResearchUrl(rawUrl)).toBeNull();
  });

  it("accepts public HTTP(S) URLs and normalizes host casing/default ports", () => {
    expect(canonicalizeResearchUrl("HTTPS://Example.COM:443/a?b=1#fragment")).toEqual({
      canonicalUrl: "https://example.com/a?b=1",
      sourceHost: "example.com",
    });
  });

  it("ignores malformed provider blocks instead of fabricating candidates", () => {
    expect(
      normalizeExaToolResult(
        textResult([
          "No search results found. Please try a different query.",
          "Title: Missing URL\nHighlights:\nNo source identity.",
        ]),
        retrievedAt,
      ),
    ).toEqual([]);
  });
});
