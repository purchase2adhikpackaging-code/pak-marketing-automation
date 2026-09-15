import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609140003_publishing_generation_quota_limit.sql"),
  "utf8",
);

describe("publishing generation quota compatibility", () => {
  it("allows the publishing worker's 120-request quota limit", () => {
    expect(sql).toContain("_request_limit > 120");
  });

  it("keeps quota consumption service-role only", () => {
    expect(sql).toContain(
      "revoke all on function public.consume_generation_quota(uuid,uuid,integer,integer) from authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.consume_generation_quota(uuid,uuid,integer,integer) to service_role",
    );
  });
});
