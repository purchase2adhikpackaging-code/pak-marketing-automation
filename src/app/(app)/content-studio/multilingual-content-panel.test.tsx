import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import { MultilingualContentPanel } from "./multilingual-content-panel";
import { generateTranslationAction, regenerateSourceAction } from "./actions";

vi.mock("./actions", () => ({
  generateTranslationAction: vi.fn(),
  regenerateSourceAction: vi.fn(),
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const contentItemId = "22222222-2222-4222-8222-222222222222";
const now = "2026-09-09T00:00:00.000Z";

function artifact(overrides: Partial<ScriptArtifact> = {}): ScriptArtifact {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId,
    contentItemId,
    language: "EN",
    isSource: true,
    status: "GENERATED",
    scriptText: "Canonical English PAK script.",
    revision: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function renderPanel(artifacts: ScriptArtifact[]) {
  return render(
    <MultilingualContentPanel
      organizationId={organizationId}
      contentItemId={contentItemId}
      artifacts={artifacts}
    />,
  );
}

describe("MultilingualContentPanel", () => {
  beforeEach(() => {
    vi.mocked(generateTranslationAction).mockReset();
    vi.mocked(regenerateSourceAction).mockReset();
  });

  it("renders exactly English, Polish, and Hindi cards and identifies the canonical source", () => {
    renderPanel([artifact()]);

    expect(screen.getAllByTestId("language-card")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "English" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Polish" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hindi" })).toBeTruthy();
    expect(screen.getByText("Canonical source")).toBeTruthy();
    expect(screen.getByText("Revision 3")).toBeTruthy();
  });

  it("renders safe states and target actions for missing, stale, failed, and generating translations", () => {
    const { rerender } = renderPanel([
      artifact(),
      artifact({
        id: "44444444-4444-4444-8444-444444444444",
        language: "HI",
        isSource: false,
        status: "STALE",
        scriptText: "Old Hindi translation.",
        revision: 2,
        sourceRevision: 2,
      }),
    ]);

    expect(screen.getByText("Source changed — refresh translation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Polish translation" }).textContent).toContain("Generate translation");
    expect(screen.getByRole("button", { name: "Refresh Hindi translation" }).textContent).toContain("Refresh translation");

    rerender(
      <MultilingualContentPanel
        organizationId={organizationId}
        contentItemId={contentItemId}
        artifacts={[
          artifact(),
          artifact({
            id: "55555555-5555-4555-8555-555555555555",
            language: "PL",
            isSource: false,
            status: "FAILED",
            revision: 2,
            sourceRevision: 3,
          }),
          artifact({
            id: "66666666-6666-4666-8666-666666666666",
            language: "HI",
            isSource: false,
            status: "GENERATING",
            revision: 2,
            sourceRevision: 3,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Retry Polish translation" }).textContent).toContain("Retry translation");
    expect((screen.getByRole("button", { name: "Hindi translation generating" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("FAILED")).toBeTruthy();
    expect(screen.getByText("GENERATING")).toBeTruthy();
  });

  it("offers regeneration only on the source card and never translation to the source language", () => {
    renderPanel([artifact()]);

    expect(screen.getByRole("button", { name: "Regenerate English source" }).textContent).toContain("Regenerate source");
    expect(screen.queryByRole("button", { name: "Generate English translation" })).toBeNull();
  });

  it("calls the translation action with only the selected business identifiers", async () => {
    vi.mocked(generateTranslationAction).mockResolvedValue({
      ok: true,
      artifact: artifact({
        id: "77777777-7777-4777-8777-777777777777",
        language: "PL",
        isSource: false,
        status: "GENERATED",
        scriptText: "Polish PAK translation.",
        revision: 2,
        sourceRevision: 3,
      }),
    });

    renderPanel([artifact()]);
    fireEvent.click(screen.getByRole("button", { name: "Generate Polish translation" }));

    await waitFor(() => {
      expect(generateTranslationAction).toHaveBeenCalledWith({ organizationId, contentItemId, targetLanguage: "PL" });
    });
    expect(await screen.findByText("Polish PAK translation.")).toBeTruthy();
  });

  it("displays safe action errors without exposing provider internals", async () => {
    vi.mocked(regenerateSourceAction).mockResolvedValue({
      ok: false,
      error: "Content artifact generation is temporarily unavailable.",
    });

    renderPanel([artifact()]);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate English source" }));

    expect(await screen.findByText("Content artifact generation is temporarily unavailable.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("provider raw");
  });
});
