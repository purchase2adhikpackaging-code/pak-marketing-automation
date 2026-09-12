import { describe, expect, it, vi } from "vitest";

import {
  executeEnqueueFinalAssemblyAction,
  type FinalAssemblyActionDependencies,
} from "./final-assembly-actions";

const input = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  planVersionId: "22222222-2222-4222-8222-222222222222",
  profile: "PAK_MASTER_1080P_V1" as const,
};

function deps(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST"): FinalAssemblyActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }),
    getRole: vi.fn().mockResolvedValue(role),
    enqueue: vi.fn().mockResolvedValue({
      assemblyId: "44444444-4444-4444-8444-444444444444",
      jobId: "55555555-5555-4555-8555-555555555555",
      reused: false,
    }),
  };
}

describe("final assembly server action", () => {
  it.each(["OWNER", "ADMIN", "EDITOR"] as const)("allows %s to enqueue IDs-only final render", async (role) => {
    const dependencies = deps(role);
    const result = await executeEnqueueFinalAssemblyAction(input, dependencies);

    expect(result).toEqual({
      ok: true,
      assemblyId: "44444444-4444-4444-8444-444444444444",
      jobId: "55555555-5555-4555-8555-555555555555",
      reused: false,
    });
    expect(dependencies.enqueue).toHaveBeenCalledWith(input);
  });

  it.each(["REVIEWER", "ANALYST"] as const)("rejects %s before enqueue", async (role) => {
    const dependencies = deps(role);
    const result = await executeEnqueueFinalAssemblyAction(input, dependencies);
    expect(result.ok).toBe(false);
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it("rejects extra or malformed input before authorization", async () => {
    const dependencies = deps("OWNER");
    const result = await executeEnqueueFinalAssemblyAction({ ...input, provider: "ffmpeg", planVersionId: "bad" }, dependencies);
    expect(result.ok).toBe(false);
    expect(dependencies.getRole).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });
});
