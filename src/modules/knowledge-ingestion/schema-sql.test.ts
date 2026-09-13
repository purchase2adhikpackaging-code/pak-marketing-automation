import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260912180100_knowledge_documents.sql",
);

function source(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("knowledge document database lifecycle", () => {
  it("creates revisioned FILE/URL source records with bounded extraction state", () => {
    const sql = source();
    expect(sql).toContain("create table if not exists public.knowledge_documents");
    expect(sql).toContain("source_type text not null check (source_type in ('FILE','URL'))");
    expect(sql).toContain("format text not null check (format in ('PDF','DOCX','PPTX','TXT','URL'))");
    expect(sql).toContain("extraction_status text not null default 'PENDING'");
    for (const status of ["PENDING", "PROCESSING", "EXTRACTED", "FAILED"]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain("revision integer not null default 1");
    expect(sql).toContain("extracted_text text");
    expect(sql).toContain("source_fingerprint text");
  });

  it("enforces exactly one authoritative source identity and same-org DOCUMENT assets", () => {
    const sql = source();
    expect(sql).toContain("media_asset_id uuid references public.media_assets(id) on delete restrict");
    expect(sql).toContain("source_url text");
    expect(sql).toContain("enforce_knowledge_document_source_integrity");
    expect(sql).toContain("new.source_type = 'FILE'");
    expect(sql).toContain("new.media_asset_id is null");
    expect(sql).toContain("new.source_url is not null");
    expect(sql).toContain("m.organization_id <> new.organization_id");
    expect(sql).toContain("m.asset_type <> 'DOCUMENT'");
    expect(sql).toContain("m.status <> 'ACTIVE'");
    expect(sql).not.toContain("signed_url");
    expect(sql).not.toContain("storage_path text");
  });

  it("links resulting Knowledge only through DRAFT records and protects source identity", () => {
    const sql = source();
    expect(sql).toContain("add column if not exists knowledge_document_id uuid");
    expect(sql).toContain("references public.knowledge_documents(id) on delete set null");
    expect(sql).toContain("enforce_knowledge_document_link_integrity");
    expect(sql).toContain("new.status <> 'DRAFT'");
    expect(sql).toContain("knowledge_document_source_identity_guard");
    expect(sql).toContain("source identity is immutable");
  });

  it("enables organization RLS and permits ingestion managers without exposing anonymous access", () => {
    const sql = source();
    expect(sql).toContain("alter table public.knowledge_documents enable row level security");
    expect(sql).toContain("revoke all privileges on table public.knowledge_documents from anon");
    expect(sql).toContain("public.is_org_member(organization_id)");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])");
    expect(sql).toContain("knowledge_documents_org_status_updated_idx");
  });
});