import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApprovalDetail } from "@/modules/approval/read-model";
import {
  decideApprovalAction,
  loadApprovalDetailAction,
  previewApprovalMediaAction,
} from "../actions";
import { ApprovalReviewClient } from "./approval-review-client";

vi.mock("../actions", async () => {
  const actual = await vi.importActual<typeof import("../actions")>("../actions");
  return {
    ...actual,
    decideApprovalAction: vi.fn(),
    loadApprovalDetailAction: vi.fn(),
    previewApprovalMediaAction: vi.fn(),
  };
});

const organizationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const artifactId = "33333333-3333-4333-8333-333333333333";
const contentItemId = "44444444-4444-4444-8444-444444444444";
const mediaAssetId = "66666666-6666-4666-8666-666666666666";

function contentDetail(status: ApprovalDetail["status"] = "PENDING"): ApprovalDetail {
  return {
    id: requestId,
    organizationId,
    targetType: "CONTENT_ARTIFACT",
    targetId: artifactId,
    targetRevision: 4,
    targetFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    target: {
      type: "CONTENT_ARTIFACT",
      artifactId,
      contentItemId,
      language: "EN",
      isSource: false,
      status: "GENERATED",
      revision: 4,
      sourceRevision: 7,
      scriptText: "Exact snapshotted railway safety script.",
      topic: "Railway safety",
      provider: "openai",
      providerModel: "gpt-test",
    },
    publicationIntent: { channel: "linkedin", campaign: "safety-week" },
    status,
    requestedBy: "55555555-5555-4555-8555-555555555555",
    requestedAt: "2026-09-12T08:00:00.000Z",
    createdAt: "2026-09-12T08:00:00.000Z",
    updatedAt: "2026-09-12T08:00:00.000Z",
    events: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        organizationId,
        requestId,
        actorKind: "USER",
        actorUserId: "55555555-5555-4555-8555-555555555555",
        eventType: "SUBMITTED",
        targetRevision: 4,
        createdAt: "2026-09-12T08:00:00.000Z",
      },
    ],
    knowledgeSources: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        knowledgeRecordId: "99999999-9999-4999-8999-999999999999",
        knowledgeRevision: 3,
        title: "Safety handbook",
        content: "Immutable safety handbook snapshot.",
        sourceType: "DOCUMENT",
        sourceLabel: "PAK Safety Handbook",
        createdAt: "2026-09-12T07:30:00.000Z",
      },
    ],
  };
}

function mediaDetail(status: ApprovalDetail["status"] = "PENDING"): ApprovalDetail {
  return {
    id: requestId,
    organizationId,
    targetType: "MEDIA_ASSET",
    targetId: mediaAssetId,
    targetChecksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    targetFingerprint: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    target: {
      type: "MEDIA_ASSET",
      mediaAssetId,
      assetType: "VIDEO",
      displayName: "Final safety film",
      source: "GENERATED",
      mimeType: "video/mp4",
      checksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      width: 1920,
      height: 1080,
      durationSeconds: 12,
      metadata: { kind: "FINAL_VIDEO", renderProfile: "PAK_MASTER_1080P_V1" },
    },
    publicationIntent: {},
    status,
    requestedAt: "2026-09-12T08:00:00.000Z",
    createdAt: "2026-09-12T08:00:00.000Z",
    updatedAt: "2026-09-12T08:00:00.000Z",
    events: [],
    knowledgeSources: [],
  };
}

function renderReview(detail: ApprovalDetail, role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST" = "REVIEWER") {
  return render(<ApprovalReviewClient organizationId={organizationId} role={role} initialDetail={detail} />);
}

describe("ApprovalReviewClient", () => {
  beforeEach(() => {
    vi.mocked(decideApprovalAction).mockReset();
    vi.mocked(loadApprovalDetailAction).mockReset();
    vi.mocked(previewApprovalMediaAction).mockReset();
  });

  it("renders the exact content snapshot, immutable provenance, review context and audit history", () => {
    renderReview(contentDetail());

    expect(screen.getByText("Exact snapshotted railway safety script.")).toBeInTheDocument();
    expect(screen.getByText(/Revision 4/)).toBeInTheDocument();
    expect(screen.getByText(/Source revision 7/)).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("Safety handbook")).toBeInTheDocument();
    expect(screen.getByText("Immutable safety handbook snapshot.")).toBeInTheDocument();
    expect(screen.getByText(/non-authoritative review context/i)).toBeInTheDocument();
    expect(screen.getByText(/linkedin/i)).toBeInTheDocument();
    expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
  });

  it("shows decision controls only to decision roles on PENDING requests", () => {
    const { rerender } = renderReview(contentDetail(), "REVIEWER");
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();

    rerender(<ApprovalReviewClient organizationId={organizationId} role="EDITOR" initialDetail={contentDetail()} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    rerender(<ApprovalReviewClient organizationId={organizationId} role="REVIEWER" initialDetail={contentDetail("SUPERSEDED")} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("requires comments for request changes/reject and refreshes authoritative detail after a decision", async () => {
    vi.mocked(decideApprovalAction).mockResolvedValue({
      ok: true,
      requestId,
      status: "CHANGES_REQUESTED",
      staleTarget: false,
    });
    vi.mocked(loadApprovalDetailAction).mockResolvedValue({
      ok: true,
      detail: { ...contentDetail("CHANGES_REQUESTED"), events: [
        ...contentDetail().events,
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organizationId,
          requestId,
          actorKind: "USER",
          eventType: "CHANGES_REQUESTED",
          comment: "Clarify the opening line.",
          targetRevision: 4,
          createdAt: "2026-09-12T08:10:00.000Z",
        },
      ] },
    });

    renderReview(contentDetail());
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
    expect(await screen.findByText(/comment is required/i)).toBeInTheDocument();
    expect(decideApprovalAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Decision comment"), { target: { value: "Clarify the opening line." } });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    await waitFor(() => expect(decideApprovalAction).toHaveBeenCalledWith({
      organizationId,
      requestId,
      decision: "REQUEST_CHANGES",
      comment: "Clarify the opening line.",
    }));
    await waitFor(() => expect(loadApprovalDetailAction).toHaveBeenCalledWith({ organizationId, requestId }));
    expect(await screen.findByText("CHANGES REQUESTED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("allows approve without a comment", async () => {
    vi.mocked(decideApprovalAction).mockResolvedValue({ ok: true, requestId, status: "APPROVED", staleTarget: false });
    vi.mocked(loadApprovalDetailAction).mockResolvedValue({ ok: true, detail: contentDetail("APPROVED") });
    renderReview(contentDetail());

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(decideApprovalAction).toHaveBeenCalledWith({
      organizationId,
      requestId,
      decision: "APPROVE",
    }));
  });

  it("creates a secure media preview only on demand and surfaces safe preview errors", async () => {
    vi.mocked(previewApprovalMediaAction)
      .mockResolvedValueOnce({
        ok: true,
        mediaAssetId,
        signedUrl: "https://signed.example/media",
        expiresInSeconds: 300,
      })
      .mockResolvedValueOnce({ ok: false, error: "A secure media preview could not be created." });

    const { rerender } = renderReview(mediaDetail());
    expect(screen.getByText("Final safety film")).toBeInTheDocument();
    expect(screen.getByText(/sha256:bbbb/)).toBeInTheDocument();
    expect(previewApprovalMediaAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /create secure preview/i }));
    await waitFor(() => expect(previewApprovalMediaAction).toHaveBeenCalledWith({ organizationId, mediaAssetId }));
    expect(await screen.findByText(/secure preview ready/i)).toBeInTheDocument();

    rerender(<ApprovalReviewClient organizationId={organizationId} role="REVIEWER" initialDetail={mediaDetail()} />);
    fireEvent.click(screen.getByRole("button", { name: /create secure preview/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A secure media preview could not be created.");
  });
});
