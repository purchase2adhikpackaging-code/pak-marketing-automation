import { describe, expect, it, vi } from "vitest";

import {
  executeSaveOrganizationProfileAction,
  type OrganizationProfileActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";

const profile = {
  officialName: "Polish Railway Academy",
  shortName: "PAK",
  about: "Railway education and training.",
  socialLinks: {},
  defaultLanguage: "en",
  timezone: "Europe/Warsaw",
  legalIdentifiers: {},
  expectedRevision: 1,
};

function deps(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST" | null): OrganizationProfileActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    getMembership: vi.fn().mockResolvedValue(role ? { role } : null),
    saveProfile: vi.fn().mockResolvedValue({
      organizationId,
      officialName: profile.officialName,
      shortName: profile.shortName,
      about: profile.about,
      socialLinks: {},
      defaultLanguage: "en",
      timezone: "Europe/Warsaw",
      legalIdentifiers: {},
      revision: 2,
      updatedBy: actorId,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:01:00.000Z",
    }),
  };
}

describe("Organization Profile server action", () => {
  it("allows OWNER/ADMIN and passes only validated profile fields to persistence", async () => {
    for (const role of ["OWNER", "ADMIN"] as const) {
      const dependencies = deps(role);
      const result = await executeSaveOrganizationProfileAction({ organizationId, profile }, dependencies);
      expect(result.ok).toBe(true);
      expect(dependencies.saveProfile).toHaveBeenCalledWith({ organizationId, ...profile });
    }
  });

  it("rejects EDITOR/REVIEWER/ANALYST and non-members before mutation", async () => {
    for (const role of ["EDITOR", "REVIEWER", "ANALYST", null] as const) {
      const dependencies = deps(role);
      const result = await executeSaveOrganizationProfileAction({ organizationId, profile }, dependencies);
      expect(result.ok).toBe(false);
      expect(dependencies.saveProfile).not.toHaveBeenCalled();
    }
  });

  it("rejects malformed and browser-supplied trusted fields", async () => {
    const dependencies = deps("OWNER");
    expect((await executeSaveOrganizationProfileAction({
      organizationId,
      profile: { ...profile, revision: 99 },
    }, dependencies)).ok).toBe(false);
    expect(dependencies.saveProfile).not.toHaveBeenCalled();
  });

  it("maps persistence failures to safe user text", async () => {
    const dependencies = deps("OWNER");
    dependencies.saveProfile = vi.fn().mockRejectedValue(new Error("database secret detail"));
    const result = await executeSaveOrganizationProfileAction({ organizationId, profile }, dependencies);
    expect(result).toEqual({ ok: false, error: "Organization Profile could not be saved." });
    expect(JSON.stringify(result)).not.toContain("database secret detail");
  });
});
