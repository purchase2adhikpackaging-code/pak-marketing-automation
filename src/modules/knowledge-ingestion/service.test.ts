import { describe, expect, it, vi } from "vitest";

import { extractKnowledgeSource, type KnowledgeExtractionDependencies } from "./service";

describe("extractKnowledgeSource", () => {
  it("returns server-derived text and stable fingerprint for file sources", async () => {
    const dependencies: KnowledgeExtractionDependencies = {
      extractFileText: vi.fn().mockResolvedValue("PAK railway operations"),
      fetchUrlText: vi.fn(),
    };

    const result = await extractKnowledgeSource({
      sourceType: "FILE",
      format: "PDF",
      bytes: new Uint8Array([1, 2, 3]),
    }, dependencies);

    expect(result.text).toBe("PAK railway operations");
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.canonicalUrl).toBeUndefined();
    expect(dependencies.fetchUrlText).not.toHaveBeenCalled();
  });

  it("uses the canonical validated URL and hashes fetched bytes/text server-side", async () => {
    const dependencies: KnowledgeExtractionDependencies = {
      extractFileText: vi.fn(),
      fetchUrlText: vi.fn().mockResolvedValue({
        canonicalUrl: "https://example.org/programmes",
        text: "PAK programmes",
        bytes: new TextEncoder().encode("PAK programmes"),
        contentType: "text/html",
      }),
    };

    const result = await extractKnowledgeSource({
      sourceType: "URL",
      url: "https://example.org/programmes#fragment",
    }, dependencies);

    expect(result.canonicalUrl).toBe("https://example.org/programmes");
    expect(result.text).toBe("PAK programmes");
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(dependencies.extractFileText).not.toHaveBeenCalled();
  });
});