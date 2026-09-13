import { describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import {
  executeSetCoreKnowledgeAction,
  type CoreKnowledgeActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";

const coreRecord: KnowledgeRecord = {
  id: recordId,
  organizationId,
  title: "PAK institutional facts",
  content: "Official institutional facts.",
  status: "ACTIVE",
  sourceType: "MANUAL",
  isCore: true,
  revision: 5,
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

function dependencies(role: AppRole): CoreKnowledgeActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    getMembership: vi.fn().mockResolvedValue({ role }),
    setCore: vi.fn().mockResolvedValue(coreRecord),
  };
}

describe("Core Knowledge action", () => {
  it.each(["OWNER", "ADMIN"] as const)("allows %s to change Core Knowledge", async (role) => {
    const deps = dependencies(role);
    const result = await executeSetCoreKnowledgeAction({
      id: recordId,
      organizationId,
      expectedRevision: 4,
      isCore: true,
    }, deps);

    expect(deps.setCore).toHaveBeenCalledWith(
      recordId,
      organizationId,
      4,
      true,
      actorId,
    );
    expect(result).toEqual({ ok: true, record: coreRecord });
  });

  it.each(["EDITOR", "REVIEWER", "ANALYST"] as const)("rejects %s before repository mutation", async (role) => {
    const deps = dependencies(role);
    const result = await executeSetCoreKnowledgeAction({
      id: recordId,
      organizationId,
      expectedRevision: 4,
      isCore: true,
    }, deps);

    expect(result).toEqual({
      ok: false,
      error: "Only organization Owners and Admins may change Core Knowledge.",
    });
    expect(deps.setCore).not.toHaveBeenCalled();
  });

  it("rejects extra/untrusted fields", async () => {
    const deps = dependencies("OWNER");
    const result = await executeSetCoreKnowledgeAction({
      id: recordId,
      organizationId,
      expectedRevision: 4,
      isCore: true,
      content: "browser supplied replacement",
    }, deps);

    expect(result.ok).toBe(false);
    expect(deps.setCore).not.toHaveBeenCalled();
  });
});
