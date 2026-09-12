import { describe, expect, it, vi } from "vitest";

import {
  OrganizationProfileRepository,
  type OrganizationProfilePersistence,
} from "./repository";

const organizationId = "11111111-1111-4111-8111-111111111111";

function stored(revision = 1) {
  return {
    organizationId,
    officialName: "Polish Railway Academy",
    socialLinks: {},
    defaultLanguage: "en",
    timezone: "Europe/Warsaw",
    legalIdentifiers: {},
    revision,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

describe("OrganizationProfileRepository", () => {
  it("reads only by explicit organization ID", async () => {
    const persistence: OrganizationProfilePersistence = {
      get: vi.fn().mockResolvedValue(stored()),
      compareAndSet: vi.fn(),
    };
    const repository = new OrganizationProfileRepository(persistence);
    expect(await repository.get(organizationId)).toEqual(stored());
    expect(persistence.get).toHaveBeenCalledWith(organizationId);
  });

  it("advances revision exactly once and detects stale writes", async () => {
    const persistence: OrganizationProfilePersistence = {
      get: vi.fn(),
      compareAndSet: vi.fn().mockResolvedValueOnce(stored(2)).mockResolvedValueOnce(null),
    };
    const repository = new OrganizationProfileRepository(persistence);
    const input = {
      organizationId,
      officialName: "Polish Railway Academy",
      socialLinks: {},
      defaultLanguage: "en",
      timezone: "Europe/Warsaw",
      legalIdentifiers: {},
      expectedRevision: 1,
    };

    expect((await repository.update(input)).revision).toBe(2);
    expect(persistence.compareAndSet).toHaveBeenCalledWith(
      organizationId,
      1,
      expect.objectContaining({ revision: 2 }),
    );
    await expect(repository.update(input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
