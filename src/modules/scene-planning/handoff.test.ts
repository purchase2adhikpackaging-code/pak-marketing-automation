import { describe, expect, it } from "vitest";
import { buildApprovedVideoGenerationPackage, type ApprovedPlanSnapshot } from "./handoff";

function approvedSnapshot(): ApprovedPlanSnapshot {
  return {
    planVersionId: "plan-v1",
    organizationId: "org-1",
    videoProjectId: "video-project-1",
    status: "APPROVED",
    sourceIntegrityHash: "sha256:abc",
    canonicalNarration: "Railway excellence begins with disciplined training.",
    language: "EN",
    aspectRatio: "16:9",
    visualBibleSnapshot: {
      realismLevel: "photorealistic institutional documentary-cinematic",
      cameraLanguage: "restrained camera movement",
      globalNegativeConstraints: ["no plastic faces"],
    },
    qcFindings: [],
    scenes: [
      {
        ordinal: 1,
        durationSeconds: 6,
        shots: [
          {
            ordinal: 1,
            durationSeconds: 6,
            creativeDirection: "Trainer enters a realistic railway lab.",
            masterVisualPrompt: "Photorealistic European railway training laboratory.",
            narrationStartChar: 0,
            narrationEndChar: 50,
            narrationText: "Railway excellence begins with disciplined training.",
            subjectRefs: ["person:trainer-1"],
            locationRefs: ["location:lab-1"],
            generationRequirements: { preserveNarration: true, providerNeutral: true },
          },
        ],
      },
    ],
  };
}

describe("buildApprovedVideoGenerationPackage", () => {
  for (const status of ["DRAFT", "PLANNING", "QC_REQUIRED", "REVIEW_REQUIRED", "STALE", "SUPERSEDED", "FAILED"] as const) {
    it(`refuses ${status} plan versions`, () => {
      expect(() => buildApprovedVideoGenerationPackage({ ...approvedSnapshot(), status })).toThrow(/APPROVED/);
    });
  }

  it("refuses approved versions with BLOCKER findings", () => {
    const snapshot = approvedSnapshot();
    snapshot.qcFindings.push({ severity: "BLOCKER", code: "SOURCE_STALE", message: "stale" });
    expect(() => buildApprovedVideoGenerationPackage(snapshot)).toThrow(/BLOCKER/);
  });

  it("builds a deeply immutable provider-neutral package with locked narration and dependencies", () => {
    const pkg = buildApprovedVideoGenerationPackage(approvedSnapshot());
    expect(pkg.schemaVersion).toBe("phase6-video-generation-handoff-v1");
    expect(pkg.narration).toEqual({
      language: "EN",
      text: "Railway excellence begins with disciplined training.",
      authority: "canonical-source-artifact",
      providerMayRewrite: false,
    });
    expect(pkg.scenes[0]!.shots[0]!.subjectRefs).toEqual(["person:trainer-1"]);
    expect(pkg.scenes[0]!.shots[0]!.generationRequirements).toEqual({ preserveNarration: true, providerNeutral: true });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.scenes[0]!.shots[0]!)).toBe(true);
  });

  it("contains no provider execution field", () => {
    const json = JSON.stringify(buildApprovedVideoGenerationPackage(approvedSnapshot())).toLowerCase();
    for (const forbidden of ["ltxjob", "providerjobid", "providerurl", "deploymenturl", "generationjobid"]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
