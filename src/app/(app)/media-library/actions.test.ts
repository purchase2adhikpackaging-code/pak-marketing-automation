import { describe, expect, it, vi } from "vitest";

import {
  executeArchiveMediaAction,
  executeDeleteMediaAction,
  executePreviewMediaAction,
  type MediaLibraryActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const mediaAssetId = "22222222-2222-4222-8222-222222222222";

function dependencies(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST"): MediaLibraryActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" }),
    getRole: vi.fn().mockResolvedValue(role),
    archive: vi.fn().mockResolvedValue(undefined),
    invokeEdge: vi.fn().mockResolvedValue({ mediaAssetId, signedUrl: "https://signed.example/media", expiresInSeconds: 300 }),
  };
}

describe("media library actions", () => {
  it("allows editor archive and records the authenticated actor", async () => {
    const deps = dependencies("EDITOR");
    const result = await executeArchiveMediaAction({ organizationId, mediaAssetId }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.archive).toHaveBeenCalledWith(
      organizationId,
      mediaAssetId,
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("rejects reviewer archive", async () => {
    const deps = dependencies("REVIEWER");
    const result = await executeArchiveMediaAction({ organizationId, mediaAssetId }, deps);

    expect(result.ok).toBe(false);
    expect(deps.archive).not.toHaveBeenCalled();
  });

  it("allows permanent delete only to owner/admin and routes deletion through trusted Edge", async () => {
    const editorDeps = dependencies("EDITOR");
    expect((await executeDeleteMediaAction({ organizationId, mediaAssetId }, editorDeps)).ok).toBe(false);
    expect(editorDeps.invokeEdge).not.toHaveBeenCalled();

    const adminDeps = dependencies("ADMIN");
    const result = await executeDeleteMediaAction({ organizationId, mediaAssetId }, adminDeps);
    expect(result).toEqual({ ok: true });
    expect(adminDeps.invokeEdge).toHaveBeenCalledWith({ operation: "delete", organizationId, mediaAssetId });
  });

  it("allows read-only organization members to request a signed preview", async () => {
    const deps = dependencies("ANALYST");
    const result = await executePreviewMediaAction({ organizationId, mediaAssetId }, deps);

    expect(result).toEqual({
      ok: true,
      mediaAssetId,
      signedUrl: "https://signed.example/media",
      expiresInSeconds: 300,
    });
    expect(deps.invokeEdge).toHaveBeenCalledWith({ operation: "preview", organizationId, mediaAssetId });
  });

  it("rejects malformed IDs before authorization or mutation", async () => {
    const deps = dependencies("OWNER");
    const result = await executeDeleteMediaAction({ organizationId: "bad", mediaAssetId }, deps);
    expect(result.ok).toBe(false);
    expect(deps.getRole).not.toHaveBeenCalled();
    expect(deps.invokeEdge).not.toHaveBeenCalled();
  });
});
