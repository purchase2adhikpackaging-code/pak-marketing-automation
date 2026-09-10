import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609100014_generation_rate_limit.sql"),
  "utf8",
);

describe("generation rate-limit SQL security", () => {
  it("keeps quota counters inaccessible to browser roles", () => {
    expect(sql).toContain("alter table public.generation_rate_windows enable row level security");
    expect(sql).toContain("revoke all on table public.generation_rate_windows from anon");
    expect(sql).toContain("revoke all on table public.generation_rate_windows from authenticated");
  });

  it("authorizes generation roles inside the privileged function", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("m.organization_id = _organization_id");
    expect(sql).toContain("m.user_id = _actor_user_id");
    expect(sql).toContain("m.role in ('OWNER','ADMIN','EDITOR')");
  });

  it("increments one atomic tenant-and-actor window counter", () => {
    expect(sql).toContain("primary key (organization_id, actor_user_id, window_start)");
    expect(sql).toContain("on conflict (organization_id, actor_user_id, window_start)");
    expect(sql).toContain("request_count = public.generation_rate_windows.request_count + 1");
  });

  it("exposes quota consumption only to service_role", () => {
    expect(sql).toContain("revoke all on function public.consume_generation_quota(uuid,uuid,integer,integer) from authenticated");
    expect(sql).toContain("grant execute on function public.consume_generation_quota(uuid,uuid,integer,integer) to service_role");
  });
});
