import { describe, expect, it } from "vitest";
import { computeSceneSourceIntegrityHash } from "./source-integrity";

describe("computeSceneSourceIntegrityHash", () => {
  it("is deterministic and changes when artifact identity, revision, or canonical narration changes", () => {
    const base = computeSceneSourceIntegrityHash({ artifactId: "artifact-1", revision: 2, scriptText: "Exact narration" });
    expect(base).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(computeSceneSourceIntegrityHash({ artifactId: "artifact-1", revision: 2, scriptText: "Exact narration" })).toBe(base);
    expect(computeSceneSourceIntegrityHash({ artifactId: "artifact-2", revision: 2, scriptText: "Exact narration" })).not.toBe(base);
    expect(computeSceneSourceIntegrityHash({ artifactId: "artifact-1", revision: 3, scriptText: "Exact narration" })).not.toBe(base);
    expect(computeSceneSourceIntegrityHash({ artifactId: "artifact-1", revision: 2, scriptText: "Exact narration changed" })).not.toBe(base);
  });
});
