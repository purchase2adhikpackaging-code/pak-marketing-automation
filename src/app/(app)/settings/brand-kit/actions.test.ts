import { describe, expect, it, vi } from "vitest";

import {
  executeSaveBrandKitAction,
  type BrandKitActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const primaryLogoAssetId = "33333333-3333-4333-8333-333333333333";

const brandKit = {
  primaryColor: "#0B3D2E",
  secondaryColor: "#F5F1E8",
  accentColor: "#C9A227",
  typographyRules: "Institutional serif headings and clean sans-serif body copy.",
  brandVoice: "Professional, precise and trustworthy.",
  logoUsageRules: "Use only official logo assets without distortion.",
  visualConstraints: "No fake seals or unapproved colors.",
  primaryLogoAssetId,
  approvedImageryAssetIds: [] as string[],
  expectedRevision: 1,
};

function deps(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST" | null): BrandKitActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    getMembership: vi.fn().mockResolvedValue(role ? { role } : null),
    saveBrandKit: vi.fn().mockResolvedValue({
      organizationId,
      primaryColor: brandKit.primaryColor,
      secondaryColor: brandKit.secondaryColor,
      accentColor: brandKit.accentColor,
      typographyRules: brandKit.typographyRules,
      brandVoice: brandKit.brandVoice,
      logoUsageRules: brandKit.logoUsageRules,
      visualConstraints: brandKit.visualConstraints,
      primaryLogoAssetId,
      approvedImageryAssetIds: [],
      revision: 2,
      updatedBy: actorId,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:01:00.000Z",
    }),
  };
}

describe("Brand Kit server action", () => {
  it("allows OWNER/ADMIN and passes only stable Media Library IDs plus brand fields", async () => {
    for (const role of ["OWNER", "ADMIN"] as const) {
      const dependencies = deps(role);
      const result = await executeSaveBrandKitAction({ organizationId, brandKit }, dependencies);
      expect(result.ok).toBe(true);
      expect(dependencies.saveBrandKit).toHaveBeenCalledWith({ organizationId, ...brandKit });
      expect(dependencies.saveBrandKit).not.toHaveBeenCalledWith(expect.objectContaining({
        signedUrl: expect.anything(),
        storagePath: expect.anything(),
      }));
    }
  });

  it("rejects non-admin organization roles before mutation", async () => {
    for (const role of ["EDITOR", "REVIEWER", "ANALYST", null] as const) {
      const dependencies = deps(role);
      const result = await executeSaveBrandKitAction({ organizationId, brandKit }, dependencies);
      expect(result.ok).toBe(false);
      expect(dependencies.saveBrandKit).not.toHaveBeenCalled();
    }
  });

  it("rejects raw storage identity and signed URLs supplied by the browser", async () => {
    const dependencies = deps("OWNER");
    expect((await executeSaveBrandKitAction({
      organizationId,
      brandKit: { ...brandKit, storagePath: "private/logo.svg" },
    }, dependencies)).ok).toBe(false);
    expect((await executeSaveBrandKitAction({
      organizationId,
      brandKit: { ...brandKit, signedUrl: "https://signed.example/logo" },
    }, dependencies)).ok).toBe(false);
    expect(dependencies.saveBrandKit).not.toHaveBeenCalled();
  });

  it("maps persistence/RPC failures to safe user text", async () => {
    const dependencies = deps("ADMIN");
    dependencies.saveBrandKit = vi.fn().mockRejectedValue(new Error("cross-org media secret"));
    const result = await executeSaveBrandKitAction({ organizationId, brandKit }, dependencies);
    expect(result).toEqual({ ok: false, error: "Brand Kit could not be saved." });
    expect(JSON.stringify(result)).not.toContain("cross-org media secret");
  });
});
