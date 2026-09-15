import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileCheckpointStore } from "@/modules/publishing-factory/checkpoint-store";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { BookVisualPlan, ResolvedBookVisualBundle } from "@/modules/publishing-factory/visual-production";

const job: BookJob = {
  bookId: "PAK-D01-S1-D01-101-TEXTBOOK", programmeCode: "PAK-D01", programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance", level: "diploma", academicPeriod: "S1", subjectCode: "D01-101", subjectTitle: "Railway Systems & Rolling Stock Fundamentals", publicationType: "textbook", edition: "2026", revision: "0.2.0", curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"], status: "VISUALS_READY", repairAttempts: {},
};
const plan: BookVisualPlan = { bookId: job.bookId, requirements: [{ id: "front-cover-d01-101", placement: "front-cover", subjectPrompt: "Photorealistic railway cover", caption: "Front cover", altText: "Railway textbook front cover", realistic: true, labelsRequired: false }] };
const bundle: ResolvedBookVisualBundle = { bookId: job.bookId, visuals: [{ ...plan.requirements[0]!, assetId: "pak-library/front-cover-d01-101", mimeType: "image/jpeg", width: 1800, height: 2700, byteLength: 200000, sourceKind: "approved-library", provenance: "PAK approved textbook visual library", dataUri: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD", realismVerified: true, labelsPresent: false }] };
function store() { return new FileCheckpointStore(mkdtempSync(join(tmpdir(), "pak-visual-checkpoints-"))); }

describe("visual production checkpoints", () => {
  it("round-trips visual plan and resolved assets", async () => { const checkpoints = store(); await checkpoints.saveVisualPlan(job, plan); await checkpoints.saveVisualAssets(job, bundle); const resumed = await checkpoints.loadRun(job.bookId, job.edition, job.revision); expect(resumed?.visualPlan).toEqual(plan); expect(resumed?.visualAssets).toEqual(bundle); });
  it("treats the same resolved visual bundle as immutable/idempotent", async () => { const checkpoints = store(); const first = await checkpoints.saveVisualAssets(job, bundle); const second = await checkpoints.saveVisualAssets(job, bundle); expect(second.created).toBe(false); expect(second.sha256).toBe(first.sha256); });
  it("never serializes a remote signed URL as visual identity", async () => { const checkpoints = store(); const unsafe = { ...bundle, visuals: bundle.visuals.map((visual) => ({ ...visual, dataUri: "https://example.test/object?token=secret" })) }; await expect(checkpoints.saveVisualAssets(job, unsafe)).rejects.toThrow(/data uri|visual/i); });
  it("rejects a checkpoint missing realism verification", async () => { const checkpoints = store(); const unsafe = { ...bundle, visuals: bundle.visuals.map(({ realismVerified: _removed, ...visual }) => visual) } as unknown as ResolvedBookVisualBundle; await expect(checkpoints.saveVisualAssets(job, unsafe)).rejects.toThrow(/visual asset/i); });
});
