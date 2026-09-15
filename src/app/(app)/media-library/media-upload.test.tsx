import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  issueMediaUploadAction: vi.fn(),
  finalizeMediaUploadAction: vi.fn(),
}));

import { finalizeMediaUploadAction, issueMediaUploadAction } from "./actions";
import { MediaUpload } from "./media-upload";

const organizationId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const mediaAssetId = "33333333-3333-4333-8333-333333333333";

describe("MediaUpload reusable document contract", () => {
  beforeEach(() => {
    vi.mocked(issueMediaUploadAction).mockReset();
    vi.mocked(finalizeMediaUploadAction).mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("supports a caller accept filter and returns immutable selected-file metadata after private upload finalization", async () => {
    vi.mocked(issueMediaUploadAction).mockResolvedValue({
      ok: true,
      sessionId,
      signedUploadUrl: "https://storage.example/upload",
      uploadToken: "opaque-token",
      storageBucket: "media-library",
      expiresAt: "2026-09-13T17:00:00.000Z",
    });
    vi.mocked(finalizeMediaUploadAction).mockResolvedValue({
      ok: true,
      sessionId,
      mediaAssetId,
      reused: false,
    });
    const onUploaded = vi.fn();

    render(
      <MediaUpload
        organizationId={organizationId}
        accept=".pdf,.docx,.pptx,.txt"
        onUploaded={onUploaded}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upload media" }));
    const input = screen.getByLabelText("File") as HTMLInputElement;
    expect(input.getAttribute("accept")).toBe(".pdf,.docx,.pptx,.txt");

    const file = new File(["manual"], "PAK-Safety.PDF", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Start upload" }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(mediaAssetId, {
      filename: "PAK-Safety.PDF",
      mimeType: "application/pdf",
    }));
  });
});
