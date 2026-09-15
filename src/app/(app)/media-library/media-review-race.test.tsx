import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  listMediaAction: vi.fn(), previewMediaAction: vi.fn(), archiveMediaAction: vi.fn(), deleteMediaAction: vi.fn(),
  issueMediaUploadAction: vi.fn(), finalizeMediaUploadAction: vi.fn(),
}));
vi.mock("../approval-center/actions", () => ({ submitApprovalAction: vi.fn() }));

import { submitApprovalAction } from "../approval-center/actions";
import { MediaLibraryClient, type MediaOrganizationWorkspace } from "./media-library-client";

const organizationId = "11111111-1111-4111-8111-111111111111";
const assetA = {
  id: "22222222-2222-4222-8222-222222222222", organizationId, assetType: "VIDEO" as const,
  source: "UPLOAD" as const, mimeType: "video/mp4", status: "ACTIVE" as const, displayName: "Asset A",
  checksum: `sha256:${"a".repeat(64)}`, createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z", metadata: {},
};
const assetB = {
  ...assetA,
  id: "33333333-3333-4333-8333-333333333333",
  displayName: "Asset B",
  checksum: `sha256:${"b".repeat(64)}`,
};

function workspace(): MediaOrganizationWorkspace[] {
  return [{ id: organizationId, label: "PAK", role: "ADMIN", initialPage: { items: [assetA, assetB] } }];
}

describe("Media Library approval submission race", () => {
  it("does not show asset A's returned request link while asset B is selected", async () => {
    let resolveSubmission!: (value: { ok: true; requestId: string }) => void;
    vi.mocked(submitApprovalAction).mockReturnValue(new Promise((resolve) => { resolveSubmission = resolve; }));

    render(<MediaLibraryClient organizations={workspace()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Submit Asset A for review" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[1]!);

    resolveSubmission({ ok: true, requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText("Asset B")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open review request" })).not.toBeInTheDocument();
  });
});
