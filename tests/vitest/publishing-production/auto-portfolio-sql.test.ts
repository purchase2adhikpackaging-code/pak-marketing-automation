import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609140004_publishing_auto_portfolio.sql",
);

const migration = readFileSync(migrationPath, "utf8");

describe("publishing autonomous portfolio SQL contract", () => {
  it("keeps automation disabled by default and fixes rollout concurrency at four", () => {
    expect(migration).toContain("create table if not exists public.publishing_automation_settings");
    expect(migration).toMatch(/enabled boolean not null default false/);
    expect(migration).toMatch(/concurrency integer not null default 4 check \(concurrency = 4\)/);
    expect(migration).toContain("pilot_approved_at timestamptz");
  });

  it("requires enabled automation, pilot approval, and an authorized enablement actor before automatic bootstrap", () => {
    expect(migration).toContain("create or replace function public.bootstrap_publishing_auto_portfolio");
    expect(migration).toMatch(/v_setting\.enabled\s*<>\s*true/);
    expect(migration).toMatch(/v_setting\.pilot_approved_at\s+is\s+null/);
    expect(migration).toMatch(/v_setting\.enabled_by\s+is\s+null\s+or\s+not\s+exists/);
    expect(migration).toContain("m.role in ('OWNER','ADMIN')");
    expect(migration).toContain("automatic portfolio production is not enabled and pilot-approved");
    expect(migration).toContain("automatic portfolio enablement actor is not authorized");
  });

  it("creates an idempotent portfolio run and skips already released identities", () => {
    expect(migration).toMatch(/scope_type,\s*scope_value,\s*status,\s*requested_concurrency,\s*planned_count,\s*idempotency_key/);
    expect(migration).toContain("'PORTFOLIO'");
    expect(migration).toContain("on conflict (organization_id, idempotency_key)");
    expect(migration).toContain("publishing_publications");
    expect(migration).toContain("book_id");
    expect(migration).toContain("edition");
    expect(migration).toContain("revision");
    expect(migration).toContain("p.status = 'RELEASED'");
  });

  it("keeps bootstrap service-role only", () => {
    expect(migration).toContain("if auth.role() <> 'service_role' then");
    expect(migration).toContain("revoke execute on function public.bootstrap_publishing_auto_portfolio");
    expect(migration).toContain("from public");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });
});
