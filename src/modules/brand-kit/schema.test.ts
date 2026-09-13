import { describe, expect, it } from "vitest";

import { brandKitUpdateSchema } from "./schema";

const uuid = "11111111-1111-4111-8111-111111111111";

function validBrandKit() {
  return {
    primaryColor: "#0B3D2E",
    secondaryColor: "#F5F1E8",
    accentColor: "#C9A227",
    typographyRules: "Use an institutional serif headline with restrained sans-serif body copy.",
    brandVoice: "Authoritative, clear and professional.",
    logoUsageRules: "Use the primary logo on light backgrounds and the light logo on dark backgrounds.",
    visualConstraints: "No distorted logo, no fake seals, no unapproved colors.",
    primaryLogoAssetId: uuid,
    lightLogoAssetId: "22222222-2222-4222-8222-222222222222",
    darkLogoAssetId: "33333333-3333-4333-8333-333333333333",
    brandMarkAssetId: "44444444-4444-4444-8444-444444444444",
    faviconAssetId: "55555555-5555-4555-8555-555555555555",
    approvedImageryAssetIds: ["66666666-6666-4666-8666-666666666666"],
    expectedRevision: 1,
  };
}

describe("brandKitUpdateSchema", () => {
  it("accepts bounded colors, rules and stable Media Library asset IDs", () => {
    const value = validBrandKit();
    expect(brandKitUpdateSchema.parse(value)).toEqual(value);
  });

  it("rejects malformed colors, duplicate imagery and invalid asset IDs", () => {
    expect(() => brandKitUpdateSchema.parse({ ...validBrandKit(), primaryColor: "emerald" })).toThrow();
    expect(() => brandKitUpdateSchema.parse({
      ...validBrandKit(),
      approvedImageryAssetIds: [uuid, uuid],
    })).toThrow();
    expect(() => brandKitUpdateSchema.parse({ ...validBrandKit(), primaryLogoAssetId: "not-an-id" })).toThrow();
  });

  it("cannot persist raw private storage identity or signed URLs", () => {
    expect(() => brandKitUpdateSchema.parse({
      ...validBrandKit(),
      storagePath: "org/private/logo.svg",
    })).toThrow();
    expect(() => brandKitUpdateSchema.parse({
      ...validBrandKit(),
      signedUrl: "https://example.com/signed?token=secret",
    })).toThrow();
  });
});
