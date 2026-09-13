import { describe, expect, it, vi } from "vitest";

import {
  fetchSafeKnowledgeUrl,
  validateKnowledgeSourceUrl,
  type ResolveHostname,
  type SafeFetch,
} from "./url-safety";

const publicResolver: ResolveHostname = vi.fn().mockResolvedValue(["93.184.216.34"]);

describe("knowledge URL safety", () => {
  it("accepts only http/https URLs that resolve to public IP addresses", async () => {
    await expect(validateKnowledgeSourceUrl("https://example.org/programmes", publicResolver))
      .resolves.toBe("https://example.org/programmes");

    for (const unsafe of [
      "file:///etc/passwd",
      "ftp://example.org/file.txt",
      "http://localhost/admin",
      "http://127.0.0.1/admin",
      "http://10.0.0.4/internal",
      "http://172.16.0.8/internal",
      "http://192.168.1.2/internal",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/admin",
    ]) {
      await expect(validateKnowledgeSourceUrl(unsafe, publicResolver)).rejects.toThrow(/unsafe|unsupported/i);
    }
  });

  it("rejects hostnames resolving to private, loopback, link-local or metadata destinations", async () => {
    const cases = ["127.0.0.1", "10.10.0.1", "172.31.9.4", "192.168.2.2", "169.254.20.10", "::1", "fc00::1", "fe80::1"];
    for (const address of cases) {
      const resolver: ResolveHostname = vi.fn().mockResolvedValue([address]);
      await expect(validateKnowledgeSourceUrl("https://safe-looking.example/path", resolver)).rejects.toThrow(/unsafe/i);
    }
  });

  it("revalidates every redirect target instead of following redirects implicitly", async () => {
    const fetcher: SafeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({ location: "http://169.254.169.254/latest/meta-data" }),
        body: new Uint8Array(),
      });

    await expect(fetchSafeKnowledgeUrl("https://example.org/start", {
      resolveHostname: publicResolver,
      fetcher,
    })).rejects.toThrow(/unsafe/i);
  });

  it("returns sanitized bounded text only for supported textual responses", async () => {
    const fetcher: SafeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      body: new TextEncoder().encode("<html><script>steal()</script><body><h1>PAK</h1><p>Railway &amp; training</p></body></html>"),
    });

    await expect(fetchSafeKnowledgeUrl("https://example.org/programmes", {
      resolveHostname: publicResolver,
      fetcher,
    })).resolves.toMatchObject({
      canonicalUrl: "https://example.org/programmes",
      text: "PAK Railway & training",
    });
  });
});