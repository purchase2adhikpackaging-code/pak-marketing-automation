import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260912180130_knowledge_ingestion_finalize.sql"),
  "utf8",
);

describe("knowledge ingestion finalization SQL", () => {
  it("finalizes extraction and DRAFT Knowledge atomically behind an authenticated role-checked RPC", () => {
    expect(sql).toMatch(/create or replace function public\.finalize_knowledge_document_ingestion/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/i);
    expect(sql).toMatch(/auth\.uid\(\)/i);
    expect(sql).toMatch(/OWNER[\s\S]*ADMIN[\s\S]*EDITOR/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/extraction_status\s*=\s*'PROCESSING'/i);
    expect(sql).toMatch(/revision\s*=\s*p_expected_revision/i);
    expect(sql).toMatch(/insert into public\.knowledge_records/i);
    expect(sql).toMatch(/'DRAFT'/i);
    expect(sql).toMatch(/knowledge_document_id/i);
    expect(sql).toMatch(/knowledge_document_revision/i);
    expect(sql).toMatch(/extraction_status\s*=\s*'EXTRACTED'/i);
    expect(sql).toMatch(/revision\s*=\s*p_expected_revision\s*\+\s*1/i);
    expect(sql).toMatch(/revoke all on function public\.finalize_knowledge_document_ingestion/i);
    expect(sql).toMatch(/grant execute on function public\.finalize_knowledge_document_ingestion/i);
  });

  it("adds immutable source-revision identity to the resulting Knowledge record", () => {
    expect(sql).toMatch(/add column if not exists knowledge_document_revision integer/i);
    expect(sql).toMatch(
      /insert into public\.knowledge_records\s*\([\s\S]*knowledge_document_revision[\s\S]*\)\s*values\s*\([\s\S]*p_expected_revision\s*\+\s*1[\s\S]*\)/i,
    );
    expect(sql).toMatch(/knowledge document revision identity is immutable/i);
  });
});
