import { describe, expect, it, vi } from "vitest";

import {
  BrandKitRepository,
  type BrandKitPersistence,
} from "./repository";

const organizationId = "11111111-1111-4111-8111-111111111111";
const logoId = "22222222-2222-4222-8222-222222222222";

function stored(revision = 1) {
  return {
    organizationId,
    primaryColor: "#0B3D2E",
    primaryLogoAssetId: logoId,
    approvedImageryAssetIds: [],
    revision,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

describe("BrandKitRepository", () => {
  it("loads organization-scoped brand rules and semantic media assignments", async () => {
    const persistence: BrandKitPersistence = {
      get: vi.fn().mockResolvedValue(stored()),
      saveAtomic: vi.fn(),
    };
    const repository = new BrandKitRepository(persistence);
    expect(await repository.get(organizationId)).toEqual(stored());
    expect(persistence.get).toHaveBeenCalledWith(organizationId);
  });

  it("delegates one atomic save and surfaces optimistic revision conflicts", async () => {
    const persistence: BrandKitPersistence = {
      get: vi.fn(),
      saveAtomic: vi.fn().mockResolvedValueOnce(stored(2)).mockResolvedValueOnce(null),
    };
    const repository = new BrandKitRepository(persistence);
    const input = {
      organizationId,
      primaryColor: "#0B3D2E",
      primaryLogoAssetId: logoId,
      approvedImageryAssetIds: [] as string[],
      expectedRevision: 1,
    };

    expect((await repository.update(input)).revision).toBe(2);
    expect(persistence.saveAtomic).toHaveBeenCalledWith(input);
    await expect(repository.update(input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
