import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");

function hardeningSource(): string {
  const filename = readdirSync(migrationsDirectory).find((candidate) =>
    candidate.endsWith("_core_knowledge_insert_guard.sql"),
  );
  if (!filename) throw new Error("Core Knowledge insert guard migration is missing.");
  return readFileSync(join(migrationsDirectory, filename), "utf8");
}

describe("Core Knowledge database mutation boundary", () => {
  it("rejects Core inserts by non-OWNER/ADMIN actors as well as unauthorized Core updates", () => {
    const sql = hardeningSource();
    expect(sql).toContain("create or replace function public.enforce_knowledge_core_admin()");
    expect(sql).toContain("tg_op = 'INSERT'");
    expect(sql).toContain("new.is_core");
    expect(sql).toContain("array['OWNER','ADMIN']");
    expect(sql).toContain("knowledge_core_admin_insert_guard");
    expect(sql).toContain("before insert on public.knowledge_records");
    expect(sql).toContain("knowledge_core_admin_guard");
    expect(sql).toContain("before update of is_core on public.knowledge_records");
  });
});
