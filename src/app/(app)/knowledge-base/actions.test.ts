import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import type { AppRole } from "@/modules/auth/roles";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import {
  executeArchiveKnowledgeAction,
  executeCreateKnowledgeAction,
  executeDeleteKnowledgeAction,
  executeUpdateKnowledgeAction,
  type KnowledgeActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";

const createdRecord: KnowledgeRecord = {
  id: recordId,
  organizationId,
  title: "Workshop safety standard",
  content: "Approved PAK workshop safety information.",
  status: "DRAFT",
  sourceType: "MANUAL",
  revision: 1,
  createdBy: actorId,
  updatedBy: actorId,
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
};

const createInput = {
  organizationId,
  title: createdRecord.title,
  content: createdRecord.content,
  sourceType: "MANUAL" as const,
};

const updateInput = {
  ...createInput,
  id: recordId,
  expectedRevision: 1,
  status: "ACTIVE" as const,
};

const archiveInput = {
  id: recordId,
  organizationId,
  expectedRevision: 1,
};

const deleteInput = {
  id: recordId,
  organizationId,
};

function dependencies(role: AppRole = "EDITOR"): KnowledgeActionDependencies {
  return {
    getActor: async () => ({ id: actorId }),
    getMembership: async () => ({ role }),
    create: vi.fn().mockResolvedValue(createdRecord),
    update: vi.fn().mockResolvedValue({ ...createdRecord, status: "ACTIVE", revision: 2 }),
    archive: vi.fn().mockResolvedValue({ ...createdRecord, status: "ARCHIVED", revision: 2 }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Knowledge Base actions", () => {
  it("rejects unauthenticated mutation before repository calls", async () => {
    const deps = dependencies();
    deps.getActor = async () => null;

    const result = await executeCreateKnowledgeAction(createInput, deps);

    expect(result).toEqual({ ok: false, error: "You must be signed in to manage Knowledge Base records." });
    expect(deps.create).not.toHaveBeenCalled();
  });

  it("rejects invalid input safely", async () => {
    const deps = dependencies();

    const result = await executeCreateKnowledgeAction({ organizationId: "not-a-uuid" }, deps);

    expect(result).toEqual({ ok: false, error: "Please check the Knowledge Base details and try again." });
    expect(deps.getMembership).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "EDITOR"] as const)("allows %s to create and update records", async (role) => {
    const deps = dependencies(role);

    const created = await executeCreateKnowledgeAction(createInput, deps);
    const updated = await executeUpdateKnowledgeAction(updateInput, deps);

    expect(deps.create).toHaveBeenCalledWith({ ...createInput, actorUserId: actorId });
    expect(deps.update).toHaveBeenCalledWith({ ...updateInput, actorUserId: actorId });
    expect(created).toEqual({ ok: true, record: createdRecord });
    expect(updated.ok).toBe(true);
  });

  it.each(["REVIEWER", "ANALYST"] as const)("rejects %s record mutation", async (role) => {
    const deps = dependencies(role);

    const result = await executeUpdateKnowledgeAction(updateInput, deps);

    expect(result).toEqual({ ok: false, error: "You do not have permission to manage Knowledge Base records for this organization." });
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("allows editors to archive records", async () => {
    const deps = dependencies("EDITOR");

    const result = await executeArchiveKnowledgeAction(archiveInput, deps);

    expect(deps.archive).toHaveBeenCalledWith(recordId, organizationId, 1, actorId);
    expect(result.ok).toBe(true);
  });

  it.each(["OWNER", "ADMIN"] as const)("allows %s to delete records", async (role) => {
    const deps = dependencies(role);

    const result = await executeDeleteKnowledgeAction(deleteInput, deps);

    expect(deps.delete).toHaveBeenCalledWith(recordId, organizationId);
    expect(result).toEqual({ ok: true });
  });

  it.each(["EDITOR", "REVIEWER", "ANALYST"] as const)("rejects %s record deletion", async (role) => {
    const deps = dependencies(role);

    const result = await executeDeleteKnowledgeAction(deleteInput, deps);

    expect(result).toEqual({ ok: false, error: "You do not have permission to delete Knowledge Base records for this organization." });
    expect(deps.delete).not.toHaveBeenCalled();
  });

  it("returns a safe conflict message for stale updates", async () => {
    const deps = dependencies();
    deps.update = vi.fn().mockRejectedValue(new AppError("CONFLICT", "Knowledge record changed before the update completed."));

    const result = await executeUpdateKnowledgeAction(updateInput, deps);

    expect(result).toEqual({ ok: false, error: "This Knowledge Base record changed before your update completed. Refresh and try again." });
  });

  it("sanitizes raw repository errors", async () => {
    const deps = dependencies();
    deps.create = vi.fn().mockRejectedValue(new Error("database password sk-secret-do-not-leak"));

    const result = await executeCreateKnowledgeAction(createInput, deps);

    expect(result).toEqual({ ok: false, error: "Knowledge Base is temporarily unavailable." });
    expect(JSON.stringify(result)).not.toContain("sk-secret-do-not-leak");
  });
});
