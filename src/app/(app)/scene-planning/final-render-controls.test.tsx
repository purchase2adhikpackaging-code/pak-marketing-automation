import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./final-assembly-actions", () => ({ enqueueFinalAssemblyAction: vi.fn() }));

import { enqueueFinalAssemblyAction } from "./final-assembly-actions";
import { FinalRenderControls } from "./final-render-controls";

const base = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  planVersionId: "22222222-2222-4222-8222-222222222222",
};

describe("FinalRenderControls", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(enqueueFinalAssemblyAction).mockReset();
  });

  it("shows normalized blockers and no enabled render CTA when blocked", () => {
    render(<FinalRenderControls {...base} actorRole="EDITOR" view={{ ready: false, reasons: ["SHOT_MEDIA_MISSING", "SOURCE_STALE"] }} />);
    expect(screen.getByText(/required shot media is not ready/i)).not.toBeNull();
    expect(screen.getByText(/canonical source changed/i)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Generate final video" })).toBeNull();
  });

  it("shows render CTA only to operator roles when ready", () => {
    const { rerender } = render(<FinalRenderControls {...base} actorRole="EDITOR" view={{ ready: true, reasons: [] }} />);
    expect(screen.getByRole("button", { name: "Generate final video" })).not.toBeNull();

    rerender(<FinalRenderControls {...base} actorRole="ANALYST" view={{ ready: true, reasons: [] }} />);
    expect(screen.queryByRole("button", { name: "Generate final video" })).toBeNull();
  });

  it("queues IDs-only final assembly and refreshes", async () => {
    vi.mocked(enqueueFinalAssemblyAction).mockResolvedValue({
      ok: true,
      assemblyId: "33333333-3333-4333-8333-333333333333",
      jobId: "44444444-4444-4444-8444-444444444444",
      reused: false,
    });
    render(<FinalRenderControls {...base} actorRole="OWNER" view={{ ready: true, reasons: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate final video" }));

    await waitFor(() => expect(enqueueFinalAssemblyAction).toHaveBeenCalledWith({
      organizationId: base.organizationId,
      planVersionId: base.planVersionId,
      profile: "PAK_MASTER_1080P_V1",
    }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows in-progress state without duplicate render CTA", () => {
    render(<FinalRenderControls {...base} actorRole="EDITOR" view={{
      ready: false,
      reasons: ["ASSEMBLY_ALREADY_RUNNING"],
      assembly: {
        assemblyId: "33333333-3333-4333-8333-333333333333",
        jobId: "44444444-4444-4444-8444-444444444444",
        state: "PROCESSING",
      },
    }} />);
    expect(screen.getByText(/final visual master is rendering/i)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Generate final video" })).toBeNull();
  });

  it("links completed PAK media and describes visual-only output", () => {
    render(<FinalRenderControls {...base} actorRole="REVIEWER" view={{
      ready: true,
      reasons: [],
      assembly: {
        assemblyId: "33333333-3333-4333-8333-333333333333",
        jobId: "44444444-4444-4444-8444-444444444444",
        state: "COMPLETED",
        finalMediaAssetId: "55555555-5555-4555-8555-555555555555",
      },
    }} />);
    const finalMediaLink = screen.getByRole("link", { name: "Open final video in Media Library" });
    expect(finalMediaLink.getAttribute("href")).toBe(
      "/media-library?asset=55555555-5555-4555-8555-555555555555",
    );
    expect(screen.getByRole("heading", { name: "Final visual master" })).not.toBeNull();
    expect(screen.getByText(/does not add narration, music, or provider audio/i)).not.toBeNull();
  });
});
