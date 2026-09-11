import { describe, expect, it, vi } from "vitest";
import {
  executeEnqueueShotVideoGenerationAction,
  executeReconcileShotVideoGenerationAction,
  type VideoGenerationActionDependencies,
} from "./video-generation-actions";

const ids = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  planVersionId: "22222222-2222-4222-8222-222222222222",
  shotId: "33333333-3333-4333-8333-333333333333",
};

function dependencies(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST"): VideoGenerationActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }),
    getRole: vi.fn().mockResolvedValue(role),
    enqueue: vi.fn().mockResolvedValue({
      jobId: "55555555-5555-4555-8555-555555555555",
      attemptId: "66666666-6666-4666-8666-666666666666",
      reused: false,
    }),
    invokeEdge: vi.fn().mockResolvedValue({
      state: "SUBMITTED",
      jobId: "55555555-5555-4555-8555-555555555555",
      attemptId: "66666666-6666-4666-8666-666666666666",
    }),
  };
}

describe("shot video generation server actions", () => {
  it("rejects unauthenticated requests before enqueue", async () => {
    const deps = dependencies("EDITOR");
    deps.getActor = vi.fn().mockResolvedValue(null);

    await expect(executeEnqueueShotVideoGenerationAction(ids, deps)).resolves.toMatchObject({ ok: false });
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.invokeEdge).not.toHaveBeenCalled();
  });

  it.each(["REVIEWER", "ANALYST"] as const)("rejects %s before provider spend", async (role) => {
    const deps = dependencies(role);

    await expect(executeEnqueueShotVideoGenerationAction(ids, deps)).resolves.toMatchObject({ ok: false });
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.invokeEdge).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "EDITOR"] as const)("allows %s to enqueue then submit IDs only", async (role) => {
    const deps = dependencies(role);

    await expect(executeEnqueueShotVideoGenerationAction(ids, deps)).resolves.toMatchObject({
      ok: true,
      state: "SUBMITTED",
    });
    expect(deps.enqueue).toHaveBeenCalledWith(ids);
    expect(deps.invokeEdge).toHaveBeenCalledWith({
      operation: "submit",
      organizationId: ids.organizationId,
      jobId: "55555555-5555-4555-8555-555555555555",
      attemptId: "66666666-6666-4666-8666-666666666666",
    });
  });

  it("rejects browser-supplied prompt/provider fields through strict validation", async () => {
    const deps = dependencies("EDITOR");
    await expect(
      executeEnqueueShotVideoGenerationAction({ ...ids, prompt: "override", apiKey: "secret" }, deps),
    ).resolves.toMatchObject({ ok: false });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("reconciles only after editor authorization", async () => {
    const deps = dependencies("EDITOR");
    const input = {
      organizationId: ids.organizationId,
      jobId: "55555555-5555-4555-8555-555555555555",
      attemptId: "66666666-6666-4666-8666-666666666666",
    };

    await expect(executeReconcileShotVideoGenerationAction(input, deps)).resolves.toMatchObject({
      ok: true,
      state: "SUBMITTED",
    });
    expect(deps.invokeEdge).toHaveBeenCalledWith({ operation: "reconcile", ...input });
  });
});
