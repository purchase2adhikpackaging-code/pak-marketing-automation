import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");
const migrationPath = join(
  migrationsDirectory,
  "20260912180200_generation_identity_provenance.sql",
);

function source(): string {
  return readFileSync(migrationPath, "utf8");
}

function aclHardeningSource(): string {
  const filename = readdirSync(migrationsDirectory).find((candidate) =>
    candidate.endsWith("_organization_identity_provenance_acl_hardening.sql"),
  );
  if (!filename) throw new Error("Organization identity/provenance ACL hardening migration is missing.");
  return readFileSync(join(migrationsDirectory, filename), "utf8");
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

  it("removes inherited broad table ACLs and grants only the intended browser privileges", () => {
    const sql = aclHardeningSource();

    for (const table of [
      "organization_profiles",
      "organization_brand_kits",
      "brand_kit_media_assets",
      "content_item_identity_provenance",
      "content_item_knowledge_sources",
    ]) {
      expect(sql).toContain(`revoke all privileges on table public.${table} from anon`);
      expect(sql).toContain(`revoke all privileges on table public.${table} from authenticated`);
    }

    expect(sql).toContain("grant select, update on table public.organization_profiles to authenticated");
    expect(sql).toContain("grant select, update on table public.organization_brand_kits to authenticated");
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.brand_kit_media_assets to authenticated",
    );
    expect(sql).toContain(
      "grant select on table public.content_item_identity_provenance to authenticated",
    );
    expect(sql).toContain(
      "grant select on table public.content_item_knowledge_sources to authenticated",
    );
  });
});
