import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import { buildScenePlannerRequest } from "./planner";
import { applyBrandKitDefaults } from "./brand-defaults";

const organizationId = "11111111-1111-4111-8111-111111111111";

const brandKit: OrganizationBrandKit = {
  organizationId,
  primaryColor: "#102A43",
  secondaryColor: "#FFFFFF",
  accentColor: "#C89B3C",
  typographyRules: "Use institutional sans serif for overlays.",
  brandVoice: "Authoritative, precise and educational.",
  logoUsageRules: "Use the official logo without distortion.",
  visualConstraints: "Avoid unofficial railway marks and unsafe behavior.",
  primaryLogoAssetId: "22222222-2222-4222-8222-222222222222",
  approvedImageryAssetIds: ["33333333-3333-4333-8333-333333333333"],
  revision: 5,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

describe("Scene Planning Brand Kit defaults", () => {
  it("uses Brand Kit palette/typography/logo treatment as defaults while preserving explicit Visual Bible creative direction", () => {
    const empty = applyBrandKitDefaults({ realismLevel: "photorealistic" }, brandKit);
    expect(empty.visualBible.palette).toEqual({
      primary: "#102A43",
      secondary: "#FFFFFF",
      accent: "#C89B3C",
    });
    expect(empty.visualBible.typographyTreatment).toBe("Use institutional sans serif for overlays.");
    expect(empty.visualBible.logoTreatment).toBe("Use the official logo without distortion.");

    const explicit = applyBrandKitDefaults({
      palette: { projectMood: "cool industrial blue" },
      typographyTreatment: "Project-specific condensed headings.",
      logoTreatment: "Place the official mark bottom-right with clear space.",
    }, brandKit);
    expect(explicit.visualBible.palette).toEqual({ projectMood: "cool industrial blue" });
    expect(explicit.visualBible.typographyTreatment).toBe("Project-specific condensed headings.");
    expect(explicit.visualBible.logoTreatment).toBe("Place the official mark bottom-right with clear space.");
    expect(explicit.institutionalBrand).toEqual(expect.objectContaining({
      brandKitRevision: 5,
      officialPrimaryLogoAssetId: "22222222-2222-4222-8222-222222222222",
      brandVoice: "Authoritative, precise and educational.",
    }));
  });

  it("makes official logo identity authoritative without replacing Visual Bible creative-direction authority", () => {
    const applied = applyBrandKitDefaults({
      logoTreatment: "Animate the official logo as a restrained end card.",
    }, brandKit);
    const request = buildScenePlannerRequest({
      canonicalNarration: "Exact narration.",
      language: "EN",
      targetDurationSeconds: 20,
      aspectRatio: "16:9",
      qualityProfile: "CINEMATIC",
      targetPlatforms: ["youtube"],
      productionConstraints: [],
      institutionalBrand: applied.institutionalBrand,
      visualBible: applied.visualBible,
    });

    expect(request.prompt).toContain("INSTITUTIONAL_BRAND");
    expect(request.prompt).toContain("22222222-2222-4222-8222-222222222222");
    expect(request.prompt).toContain("official logo asset identity is authoritative");
    expect(request.prompt).toContain("Visual Bible remains the project creative-direction authority");
    expect(request.prompt).toContain("Animate the official logo as a restrained end card.");
  });

  it("wires the same server-resolved Brand Kit mapper into initial planning and granular replan", () => {
    const workflow = readFileSync(join(process.cwd(), "src/app/(app)/scene-planning/workflow-actions.ts"), "utf8");
    const granular = readFileSync(join(process.cwd(), "src/app/(app)/scene-planning/granular-replan-actions.ts"), "utf8");

    for (const source of [workflow, granular]) {
      expect(source).toContain("generationContextRepository.getBrandKit");
      expect(source).toContain("applyBrandKitDefaults");
      expect(source).toContain("institutionalBrand:");
    }
  });
});
