import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migrationSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120009_approval_center_schema.sql"),
    "utf8",
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 Approval Center ledger schema", () => {
  it("creates exact-target request and immutable event tables with bounded authoritative shapes", () => {
    const sql = normalizeSql(migrationSql());

    expect(sql).toContain("create table public.approval_requests");
    expect(sql).toContain("create table public.approval_events");
    expect(sql).toContain("target_type in ('content_artifact','media_asset')");
    expect(sql).toContain("status in ('pending','changes_requested','approved','rejected','superseded')");
    expect(sql).toContain("event_type in ('submitted','approved','changes_requested','rejected','superseded')");
    expect(sql).toContain("unique (organization_id, target_type, target_fingerprint)");
    expect(sql).toContain("jsonb_typeof(target_snapshot) = 'object'");
    expect(sql).toContain("jsonb_typeof(publication_intent) = 'object'");
    expect(sql).toContain("octet_length(publication_intent::text) <= 8192");
    expect(sql).toContain("char_length(comment) <= 2000");
  });

  it("enables RLS and exposes only same-org operational review reads to browser roles", () => {
    const sql = normalizeSql(migrationSql());

    expect(sql).toContain("alter table public.approval_requests enable row level security");
    expect(sql).toContain("alter table public.approval_events enable row level security");
    expect(sql).toContain("public.has_org_role(organization_id, array['owner','admin','editor','reviewer'])");

    for (const table of ["public.approval_requests", "public.approval_events"]) {
      expect(sql).toContain(`revoke all privileges on table ${table} from anon`);
      expect(sql).toContain(`revoke insert, update, delete on table ${table} from authenticated`);
      expect(sql).toContain(`grant select on table ${table} to authenticated`);
    }
  });

  it("guards approval events against update/delete and indexes queue/history reads", () => {
    const sql = normalizeSql(migrationSql());

    expect(sql).toContain("create or replace function public.prevent_approval_event_mutation()");
    expect(sql).toContain("raise exception 'approval events are immutable'");
    expect(sql).toContain("before update or delete on public.approval_events");
    expect(sql).toContain("create index approval_requests_queue_idx");
    expect(sql).toContain("organization_id, status, requested_at desc, id");
    expect(sql).toContain("create index approval_events_history_idx");
    expect(sql).toContain("approval_request_id, created_at, id");
  });

  it("keeps exact request identity and review context immutable after submission", () => {
    const sql = normalizeSql(migrationSql());

    expect(sql).toContain("create or replace function public.guard_approval_request_identity()");
    expect(sql).toContain("old.target_fingerprint is distinct from new.target_fingerprint");
    expect(sql).toContain("old.target_snapshot is distinct from new.target_snapshot");
    expect(sql).toContain("old.publication_intent is distinct from new.publication_intent");
    expect(sql).toContain("raise exception 'approval request identity is immutable'");
  });

  it("stores actor UUID snapshots without auth-user FKs so immutable audit history survives account deletion", () => {
    const sql = normalizeSql(migrationSql());

    expect(sql).toContain("requested_by uuid,");
    expect(sql).toContain("decided_by uuid,");
    expect(sql).toContain("actor_user_id uuid,");
    expect(sql).not.toContain("requested_by uuid references auth.users");
    expect(sql).not.toContain("decided_by uuid references auth.users");
    expect(sql).not.toContain("actor_user_id uuid references auth.users");
  });
});
