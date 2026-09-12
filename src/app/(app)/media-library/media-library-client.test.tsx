import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  listMediaAction: vi.fn(),
  previewMediaAction: vi.fn(),
  archiveMediaAction: vi.fn(),
  deleteMediaAction: vi.fn(),
  issueMediaUploadAction: vi.fn(),
  finalizeMediaUploadAction: vi.fn(),
}));
vi.mock("../approval-center/actions", () => ({
  submitApprovalAction: vi.fn(),
}));

import { submitApprovalAction } from "../approval-center/actions";
import {
  archiveMediaAction,
  deleteMediaAction,
  listMediaAction,
  previewMediaAction,
} from "./actions";
import { MediaLibraryClient, type MediaOrganizationWorkspace } from "./media-library-client";

const asset = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  assetType: "VIDEO" as const,
  source: "GENERATED" as const,
  mimeType: "video/mp4",
  status: "ACTIVE" as const,
  displayName: "PAK Final Visual Master",
  width: 1920,
  height: 1080,
  durationSeconds: 90,
  sizeBytes: 1024,
  checksum: `sha256:${"a".repeat(64)}`,
  generatingJobId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
  metadata: { kind: "FINAL_VIDEO", planVersionId: "44444444-4444-4444-8444-444444444444" },
};

type TestAsset = typeof asset & { checksum?: string; status: "ACTIVE" | "ARCHIVED" | "FAILED" };

function workspace(role: MediaOrganizationWorkspace["role"], item: TestAsset = asset): MediaOrganizationWorkspace[] {
  return [{
    id: asset.organizationId,
    label: "Polish Railway Academy",
    role,
    initialPage: {
      items: [item],
      nextCursor: { createdAt: item.createdAt, id: item.id },
    },
  }];
}

describe("MediaLibraryClient", () => {
  beforeEach(() => {
    vi.mocked(listMediaAction).mockReset();
    vi.mocked(previewMediaAction).mockReset();
    vi.mocked(archiveMediaAction).mockReset();
    vi.mocked(deleteMediaAction).mockReset();
    vi.mocked(submitApprovalAction).mockReset();
  });

  it("renders catalogue lineage without exposing a signed preview before explicit request", () => {
    render(<MediaLibraryClient organizations={workspace("EDITOR")} />);

    expect(screen.getByText("PAK Final Visual Master")).not.toBeNull();
    expect(screen.getByText("Final video")).not.toBeNull();
    expect(screen.queryByText("https://signed.example/media")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview PAK Final Visual Master" })).not.toBeNull();
  });

  it("requests and renders signed preview only after the operator clicks Preview", async () => {
    vi.mocked(previewMediaAction).mockResolvedValue({
      ok: true,
      mediaAssetId: asset.id,
      signedUrl: "https://signed.example/media",
      expiresInSeconds: 300,
    });

    render(<MediaLibraryClient organizations={workspace("ANALYST")} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview PAK Final Visual Master" }));

    await waitFor(() => expect(previewMediaAction).toHaveBeenCalledWith({
      organizationId: asset.organizationId,
      mediaAssetId: asset.id,
    }));
    expect(await screen.findByText("Secure preview ready")).not.toBeNull();
  });

  it("hides mutation controls from read-only roles and permanent delete from editors", () => {
    const { rerender } = render(<MediaLibraryClient organizations={workspace("ANALYST")} />);
    expect(screen.queryByRole("button", { name: "Upload media" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive PAK Final Visual Master" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete PAK Final Visual Master" })).toBeNull();

    rerender(<MediaLibraryClient organizations={workspace("EDITOR")} />);
    expect(screen.getByRole("button", { name: "Upload media" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Archive PAK Final Visual Master" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Delete PAK Final Visual Master" })).toBeNull();
  });

  it("requires confirmation before archive", async () => {
    vi.mocked(archiveMediaAction).mockResolvedValue({ ok: true });

    render(<MediaLibraryClient organizations={workspace("ADMIN")} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive PAK Final Visual Master" }));
    expect(archiveMediaAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() => expect(archiveMediaAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("PAK Final Visual Master")).toBeNull());
  });

  it("requires confirmation before admin permanent delete", async () => {
    vi.mocked(deleteMediaAction).mockResolvedValue({ ok: true });

    render(<MediaLibraryClient organizations={workspace("ADMIN")} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete PAK Final Visual Master" }));
    expect(deleteMediaAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm permanent delete" }));
    await waitFor(() => expect(deleteMediaAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("PAK Final Visual Master")).toBeNull());
  });

  it("loads the next deterministic catalogue page", async () => {
    vi.mocked(listMediaAction).mockResolvedValue({
      ok: true,
      page: { items: [] },
    });

    render(<MediaLibraryClient organizations={workspace("EDITOR")} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(listMediaAction).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: asset.organizationId,
      cursor: { createdAt: asset.createdAt, id: asset.id },
    })));
  });

  it("offers approval submission only for ACTIVE checksummed media and submit-capable roles", () => {
    const { rerender } = render(<MediaLibraryClient organizations={workspace("EDITOR")} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("button", { name: "Submit PAK Final Visual Master for review" })).toBeInTheDocument();

    rerender(<MediaLibraryClient organizations={workspace("REVIEWER")} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("button", { name: "Submit PAK Final Visual Master for review" })).not.toBeInTheDocument();

    const { checksum: _checksum, ...withoutChecksum } = asset;
    rerender(<MediaLibraryClient organizations={workspace("EDITOR", withoutChecksum as TestAsset)} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("button", { name: "Submit PAK Final Visual Master for review" })).not.toBeInTheDocument();

    rerender(<MediaLibraryClient organizations={workspace("ADMIN", { ...asset, status: "ARCHIVED" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("button", { name: "Submit PAK Final Visual Master for review" })).not.toBeInTheDocument();
  });

  it("submits only safe media identifiers/context and surfaces the review request", async () => {
    vi.mocked(submitApprovalAction).mockResolvedValue({
      ok: true,
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    render(<MediaLibraryClient organizations={workspace("ADMIN")} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit PAK Final Visual Master for review" }));

    await waitFor(() => expect(submitApprovalAction).toHaveBeenCalledWith({
      organizationId: asset.organizationId,
      targetType: "MEDIA_ASSET",
      targetId: asset.id,
      publicationIntent: { source: "media-library", assetType: "VIDEO" },
    }));
    expect(submitApprovalAction).not.toHaveBeenCalledWith(expect.objectContaining({
      checksum: expect.anything(),
      storagePath: expect.anything(),
    }));
    expect(await screen.findByRole("link", { name: "Open review request" })).toHaveAttribute(
      "href",
      `/approval-center/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?organization=${asset.organizationId}`,
    );
  });
});
