import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function workflowSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120010_approval_center_workflow.sql"),
    "utf8",
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 authoritative approval workflow RPCs", () => {
  it("submits only IDs and bounded review context, then resolves exact target state server-side", () => {
    const sql = normalizeSql(workflowSql());

    expect(sql).toContain(
      "create or replace function public.submit_approval_request( _organization_id uuid, _target_type text, _target_id uuid, _publication_intent jsonb default '{}'::jsonb )",
    );
    expect(sql).toContain("security definer set search_path = public");
    expect(sql).toContain("v_actor uuid := auth.uid()");
    expect(sql).toContain("public.has_org_role(_organization_id, array['owner','admin','editor'])");
    expect(sql).toContain("from public.content_script_artifacts a join public.content_items c");
    expect(sql).toContain("a.status = 'generated'");
    expect(sql).toContain("nullif(btrim(a.script_text), '') is not null");
    expect(sql).toContain("from public.media_assets m");
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain("nullif(btrim(m.checksum), '') is not null");
    expect(sql).toContain("digest(");
    expect(sql).toContain("target_snapshot");
    expect(sql).toContain("on conflict (organization_id, target_type, target_fingerprint) do nothing");
    expect(sql).toContain("insert into public.approval_events");
    expect(sql).toContain("'submitted'");
  });

  it("allows only review roles to decide a locked pending request and enforces comments", () => {
    const sql = normalizeSql(workflowSql());

    expect(sql).toContain(
      "create or replace function public.decide_approval_request( _organization_id uuid, _approval_request_id uuid, _decision text, _comment text default null )",
    );
    expect(sql).toContain("public.has_org_role(_organization_id, array['owner','admin','reviewer'])");
    expect(sql).toContain("for update");
    expect(sql).toContain("v_request.status <> 'pending'");
    expect(sql).toContain("v_decision in ('request_changes','reject')");
    expect(sql).toContain("char_length(btrim(v_comment)) > 2000");
    expect(sql).toContain("raise exception 'approval comment is required'");
  });

  it("revalidates exact artifact revision or media checksum before any approval decision", () => {
    const sql = normalizeSql(workflowSql());

    expect(sql).toContain("a.revision = v_request.target_revision");
    expect(sql).toContain("a.status = 'generated'");
    expect(sql).toContain("m.checksum = v_request.target_checksum");
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain("v_stale_target := true");
    expect(sql).toContain("status = 'superseded'");
    expect(sql).toContain("'superseded'");
    expect(sql).toContain("stale_target");
  });

  it("maps valid explicit decisions atomically to request state and immutable events", () => {
    const sql = normalizeSql(workflowSql());

    expect(sql).toContain("when 'approve' then 'approved'");
    expect(sql).toContain("when 'request_changes' then 'changes_requested'");
    expect(sql).toContain("when 'reject' then 'rejected'");
    expect(sql).toContain("decided_by = v_actor");
    expect(sql).toContain("decided_at = v_now");
    expect(sql).toContain("insert into public.approval_events");
  });

  it("restricts both user-callable SECURITY DEFINER functions to authenticated execution", () => {
    const sql = normalizeSql(workflowSql());

    for (const signature of [
      "public.submit_approval_request(uuid, text, uuid, jsonb)",
      "public.decide_approval_request(uuid, uuid, text, text)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public`);
      expect(sql).toContain(`revoke all on function ${signature} from anon`);
      expect(sql).toContain(`revoke all on function ${signature} from authenticated`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
    }
  });
});
