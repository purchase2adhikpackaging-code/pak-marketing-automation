import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("supabase/migrations/20260913180000_knowledge_research.sql");
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("knowledge research migration", () => {
  it("creates tenant-scoped research tables with bounded metadata", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql).toContain("create table public.research_runs");
    expect(sql).toContain("create table public.research_candidates");
    expect(sql).toMatch(/char_length\(query\)\s+between\s+3\s+and\s+300/i);
    expect(sql).toMatch(/result_count[^;]+between\s+0\s+and\s+8/i);
    expect(sql).toMatch(/char_length\(title\)\s+between\s+1\s+and\s+500/i);
    expect(sql).toMatch(/char_length\(canonical_url\)\s+between\s+1\s+and\s+2048/i);
    expect(sql).toMatch(/char_length\(source_host\)\s+between\s+1\s+and\s+255/i);
    expect(sql).toMatch(/char_length\(excerpt\)\s+between\s+1\s+and\s+4000/i);
  });

  it("enforces same-organization parent and Knowledge links", () => {
    expect(sql).toMatch(/unique\s*\(organization_id,\s*id\)/i);
    expect(sql).toMatch(/foreign key\s*\(organization_id,\s*research_run_id\)[\s\S]*references public\.research_runs\s*\(organization_id,\s*id\)/i);
    expect(sql).toMatch(/foreign key\s*\(organization_id,\s*knowledge_record_id\)[\s\S]*references public\.knowledge_records\s*\(organization_id,\s*id\)/i);
  });

  it("enables manager-only RLS and blocks authenticated direct writes", () => {
    expect(sql).toContain("alter table public.research_runs enable row level security");
    expect(sql).toContain("alter table public.research_candidates enable row level security");
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR']");
    expect(sql).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+public\.research_runs\s+from\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+public\.research_candidates\s+from\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/grant\s+select\s+on\s+public\.research_runs\s+to\s+authenticated/i);
    expect(sql).toMatch(/grant\s+select\s+on\s+public\.research_candidates\s+to\s+authenticated/i);
  });

  it("adds the required query indexes and one-Knowledge-link invariant", () => {
    expect(sql).toMatch(/on public\.research_runs\s*\(organization_id,\s*created_at desc\)/i);
    expect(sql).toMatch(/on public\.research_candidates\s*\(research_run_id\)/i);
    expect(sql).toMatch(/on public\.research_candidates\s*\(organization_id,\s*review_status,\s*created_at desc\)/i);
    expect(sql).toMatch(/unique index[\s\S]*knowledge_record_id[\s\S]*where knowledge_record_id is not null/i);
  });

  it("contains no provider credential or full-source-text storage", () => {
    expect(sql).not.toMatch(/api_key|access_token|secret_value|cookie|password|source_text/i);
  });
});
