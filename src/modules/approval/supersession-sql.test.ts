import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migrationSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120011_approval_center_supersession.sql"),
    "utf8",
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 approval supersession and currentness", () => {
  it("supersedes current workflow states without rewriting rejected history", () => {
    const sql = normalizeSql(migrationSql());
    expect(sql).toContain("create or replace function public.supersede_target_approvals");
    expect(sql).toContain("status in ('pending','changes_requested','approved')");
    expect(sql).toContain("status = 'superseded'");
    expect(sql).not.toContain("status in ('pending','changes_requested','approved','rejected')");
    expect(sql).toContain("'system'");
    expect(sql).toContain("'superseded'");
  });

  it("attaches thin triggers to content revision/status/script changes and media status/checksum changes", () => {
    const sql = normalizeSql(migrationSql());
    expect(sql).toContain("on public.content_script_artifacts");
    expect(sql).toContain("after update of revision, status, script_text");
    expect(sql).toContain("on public.media_assets");
    expect(sql).toContain("after update of status, checksum");
    expect(sql).toContain("execute function public.supersede_content_artifact_approvals()");
    expect(sql).toContain("execute function public.supersede_media_asset_approvals()");
  });

  it("keeps supersession idempotent and appends only transitioned events", () => {
    const sql = normalizeSql(migrationSql());
    expect(sql).toContain("returning r.id, r.organization_id, r.target_revision, r.target_checksum");
    expect(sql).toContain("insert into public.approval_events");
    expect(sql).toContain("from transitioned t");
  });

  it("exposes a current-approval predicate that verifies exact authoritative identity", () => {
    const sql = normalizeSql(migrationSql());
    expect(sql).toContain("create or replace function public.is_target_currently_approved(");
    expect(sql).toContain("r.status = 'approved'");
    expect(sql).toContain("a.revision = _target_revision");
    expect(sql).toContain("a.status = 'generated'");
    expect(sql).toContain("m.checksum = _target_checksum");
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain("r.target_revision = a.revision");
    expect(sql).toContain("r.target_checksum = m.checksum");
  });

  it("keeps helper private-by-ACL and grants the predicate intentionally", () => {
    const sql = normalizeSql(migrationSql());
    expect(sql).toContain("revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from public");
    expect(sql).toContain("revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from anon");
    expect(sql).toContain("revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from authenticated");
    expect(sql).toContain("revoke all on function public.is_target_currently_approved(uuid, text, uuid, integer, text) from public");
    expect(sql).toContain("revoke all on function public.is_target_currently_approved(uuid, text, uuid, integer, text) from anon");
    expect(sql).toContain("grant execute on function public.is_target_currently_approved(uuid, text, uuid, integer, text) to authenticated");
  });
});
