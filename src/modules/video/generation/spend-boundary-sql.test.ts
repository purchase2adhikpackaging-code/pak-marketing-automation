import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const attemptsSql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110008_video_generation_attempts.sql"),
  "utf8",
);
const enqueueSql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110009_video_generation_enqueue.sql"),
  "utf8",
);

describe("Phase 7 paid-provider spend boundary", () => {
  it("does not let authenticated browser roles create provider attempts directly", () => {
    expect(attemptsSql).not.toContain("create policy video_generation_attempts_insert_editor");
    expect(attemptsSql).not.toMatch(/for\s+(update|delete)\s+to\s+authenticated/i);
    expect(attemptsSql).toContain("create policy video_generation_attempts_select_member");
  });

  it("excludes video generation jobs from generic editor insert/update policies", () => {
    expect(enqueueSql).toContain("drop policy if exists jobs_insert_editor on public.jobs");
    expect(enqueueSql).toContain("drop policy if exists jobs_update_editor on public.jobs");
    expect(enqueueSql).toMatch(/create policy jobs_insert_editor[\s\S]*job_type\s*<>\s*'VIDEO_SHOT_GENERATION'/i);
    expect(enqueueSql).toMatch(/create policy jobs_update_editor[\s\S]*using[\s\S]*job_type\s*<>\s*'VIDEO_SHOT_GENERATION'[\s\S]*with check[\s\S]*job_type\s*<>\s*'VIDEO_SHOT_GENERATION'/i);
  });

  it("makes the validated enqueue RPC the only authenticated creation boundary", () => {
    expect(enqueueSql).toMatch(/create or replace function public\.enqueue_video_shot_generation[\s\S]*security definer/i);
    expect(enqueueSql).toContain("v_actor_user_id uuid := auth.uid()");
    expect(enqueueSql).toContain("public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR'])");
    expect(enqueueSql).toContain("v_plan_status <> 'APPROVED'");
    expect(enqueueSql).toContain("v_current_source_hash <> v_plan_source_hash");
    expect(enqueueSql).toContain("revoke all on function public.enqueue_video_shot_generation");
    expect(enqueueSql).toContain("grant execute on function public.enqueue_video_shot_generation");
    expect(enqueueSql).toContain("to authenticated");
  });
});
