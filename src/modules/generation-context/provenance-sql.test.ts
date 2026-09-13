import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260912180200_generation_identity_provenance.sql",
);

function source(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("generation identity provenance database contract", () => {
  it("stores immutable profile and Brand Kit revisions beside existing Knowledge snapshots", () => {
    const sql = source();
    expect(sql).toContain("create table if not exists public.content_item_identity_provenance");
    expect(sql).toContain("profile_revision integer not null");
    expect(sql).toContain("brand_kit_revision integer not null");
    expect(sql).toContain("content_item_id uuid primary key references public.content_items(id)");
    expect(sql).toContain("content_item_identity_provenance_immutable_guard");
  });

  it("persists identity and Knowledge provenance atomically through one guarded authenticated RPC", () => {
    const sql = source();
    expect(sql).toContain("create or replace function public.persist_content_generation_provenance(");
    expect(sql).toContain("_knowledge_snapshots jsonb");
    expect(sql).toContain("authentication required");
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR']");
    expect(sql).toContain("content item provenance may only be persisted by its creator");
    expect(sql).toContain("organization profile revision does not match resolved provenance");
    expect(sql).toContain("brand kit revision does not match resolved provenance");
    expect(sql).toContain("knowledge snapshot does not match resolved source revision");
    expect(sql).toContain("insert into public.content_item_identity_provenance");
    expect(sql).toContain("insert into public.content_item_knowledge_sources");
  });

  it("keeps provenance organization-scoped and read-only to ordinary authenticated users", () => {
    const sql = source();
    expect(sql).toContain("alter table public.content_item_identity_provenance enable row level security");
    expect(sql).toContain("public.is_org_member(organization_id)");
    expect(sql).not.toContain("create policy content_item_identity_provenance_insert");
    expect(sql).not.toContain("create policy content_item_identity_provenance_update");
    expect(sql).not.toContain("create policy content_item_identity_provenance_delete");
    expect(sql).toContain("grant execute on function public.persist_content_generation_provenance");
  });
});
