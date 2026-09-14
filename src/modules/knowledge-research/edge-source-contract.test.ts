import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const edgePath = resolve("supabase/functions/knowledge-research/index.ts");
const source = existsSync(edgePath) ? readFileSync(edgePath, "utf8") : "";

describe("knowledge research Edge Function source contract", () => {
  it("uses only the approved anonymous Exa MCP route and current client package", () => {
    expect(existsSync(edgePath)).toBe(true);
    expect(source).toContain('from "npm:@modelcontextprotocol/client@2.0.0"');
    expect(source).toContain('new URL("https://mcp.exa.ai/mcp")');
    expect(source).toContain('name: "web_search_exa"');
    expect(source).toMatch(/numResults:\s*MAX_RESEARCH_RESULTS|numResults:\s*8/);
    expect(source).toContain("listTools");
  });

  it("reuses the existing authenticated Edge runtime boundary", () => {
    expect(source).toContain('Deno.env.get("SUPABASE_URL")');
    expect(source).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).toContain('["OWNER", "ADMIN", "EDITOR"]');
  });

  it("does not introduce an Exa credential, login, browser session or CLI dependency", () => {
    expect(source).not.toMatch(/EXA_API_KEY|EXA_KEY|exaApiKey|x-api-key/i);
    expect(source).not.toMatch(/authProvider|requestInit\s*:\s*\{\s*headers/i);
    expect(source).not.toMatch(/mcporter|OpenCLI|browser session|cookie/i);
  });

  it("accepts only search and dismiss intent from callers", () => {
    expect(source).toContain('action === "search"');
    expect(source).toContain('action === "dismiss"');
    expect(source).not.toMatch(/input\.(provider|title|excerpt|canonicalUrl|knowledgeStatus|apiKey)/);
  });
});
