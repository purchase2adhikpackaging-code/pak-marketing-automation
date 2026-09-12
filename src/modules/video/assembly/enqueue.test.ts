import { describe, expect, it, vi } from "vitest";
import { enqueueFinalVideoAssembly } from "./enqueue";
import type { FinalAssemblyRepository } from "./repository";

describe("enqueueFinalVideoAssembly", () => {
  it("defaults to the allowlisted Phase 8 render profile", async () => {
    const repository: FinalAssemblyRepository = {
      enqueueApprovedPlan: vi.fn().mockResolvedValue({
        assemblyId: "assembly-1",
        jobId: "job-1",
        reused: false,
      }),
    };

    await expect(
      enqueueFinalVideoAssembly(
        { organizationId: "org-1", planVersionId: "plan-1" },
        repository,
      ),
    ).resolves.toEqual({
      assemblyId: "assembly-1",
      jobId: "job-1",
      reused: false,
    });

    expect(repository.enqueueApprovedPlan).toHaveBeenCalledWith({
      organizationId: "org-1",
      planVersionId: "plan-1",
      profile: "PAK_MASTER_1080P_V1",
    });
  });

  it("returns existing completed final media identity when the database reuses an assembly", async () => {
    const repository: FinalAssemblyRepository = {
      enqueueApprovedPlan: vi.fn().mockResolvedValue({
        assemblyId: "assembly-1",
        jobId: "job-1",
        reused: true,
        mediaAssetId: "media-final-1",
      }),
    };

    await expect(
      enqueueFinalVideoAssembly(
        {
          organizationId: "org-1",
          planVersionId: "plan-1",
          profile: "PAK_MASTER_1080P_V1",
        },
        repository,
      ),
    ).resolves.toEqual({
      assemblyId: "assembly-1",
      jobId: "job-1",
      reused: true,
      mediaAssetId: "media-final-1",
    });
  });

  it("rejects missing identifiers before repository invocation", async () => {
    const repository: FinalAssemblyRepository = {
      enqueueApprovedPlan: vi.fn(),
    };

    await expect(
      enqueueFinalVideoAssembly(
        { organizationId: "", planVersionId: "plan-1" },
        repository,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(repository.enqueueApprovedPlan).not.toHaveBeenCalled();
  });
});
