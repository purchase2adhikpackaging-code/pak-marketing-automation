import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import { generateContentAction } from "./actions";
import { ContentStudioForm } from "./content-studio-form";
import type { SelectableKnowledgeRecord } from "./knowledge-selector";

vi.mock("./actions", () => ({ generateContentAction: vi.fn() }));

const organizationOne = "11111111-1111-4111-8111-111111111111";
const organizationTwo = "22222222-2222-4222-8222-222222222222";
const recordOne = "33333333-3333-4333-8333-333333333333";
const recordTwo = "44444444-4444-4444-8444-444444444444";
const contentItemId = "55555555-5555-4555-8555-555555555555";
const artifactId = "66666666-6666-4666-8666-666666666666";
const now = "2026-09-09T00:00:00.000Z";

const knowledgeOne: SelectableKnowledgeRecord = { id: recordOne, title: "Approved workshop safety", sourceType: "DOCUMENT", sourceLabel: "Safety manual", revision: 4 };
const knowledgeTwo: SelectableKnowledgeRecord = { id: recordTwo, title: "Approved signalling basics", sourceType: "MANUAL", revision: 2 };
const organizations = [
  { id: organizationOne, label: "PAK Poland", knowledgeRecords: [knowledgeOne] },
  { id: organizationTwo, label: "PAK Egypt", knowledgeRecords: [knowledgeTwo] },
];

const item: ContentItem = {
  id: contentItemId,
  organizationId: organizationOne,
  topic: "Workshop safety training",
  language: "EN",
  status: "GENERATED",
  generatedScript: "Grounded PAK script.",
  provider: "openai",
  providerModel: "gpt-5.6-luna",
  createdAt: now,
  updatedAt: now,
};

const artifact: ScriptArtifact = {
  id: artifactId,
  organizationId: organizationOne,
  contentItemId,
  language: "EN",
  isSource: true,
  status: "GENERATED",
  scriptText: "Grounded PAK script.",
  revision: 1,
  provider: "openai",
  providerModel: "gpt-5.6-luna",
  createdAt: now,
  updatedAt: now,
};

describe("ContentStudioForm Knowledge grounding", () => {
  beforeEach(() => {
    vi.mocked(generateContentAction).mockReset();
    vi.mocked(generateContentAction).mockResolvedValue({ ok: true, item, artifact });
  });

  it("shows approved records for the selected organization and clears selection on organization change", () => {
    render(<ContentStudioForm organizations={organizations} />);
    expect(screen.getByText("Approved workshop safety")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Approved workshop safety" }));
    expect(screen.getByText("1 of 20 selected")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Organization" }), { target: { value: organizationTwo } });
    expect(screen.getByText("0 of 20 selected")).toBeTruthy();
    expect(screen.queryByText("Approved workshop safety")).toBeNull();
    expect(screen.getByText("Approved signalling basics")).toBeTruthy();
  });

  it("submits only selected Knowledge IDs plus optional additional context", async () => {
    render(<ContentStudioForm organizations={organizations} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "Workshop safety training" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Approved workshop safety" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Additional context" }), { target: { value: "Emphasize practical exercises." } });
    fireEvent.click(screen.getByRole("button", { name: "Generate source script" }));
    await waitFor(() => expect(generateContentAction).toHaveBeenCalledWith({
      organizationId: organizationOne,
      topic: "Workshop safety training",
      knowledgeRecordIds: [recordOne],
      knowledgeContext: "Emphasize practical exercises.",
      language: "EN",
    }));
    const payload = vi.mocked(generateContentAction).mock.calls[0]![0];
    expect(JSON.stringify(payload)).not.toContain("Approved workshop safety");
    expect(JSON.stringify(payload)).not.toContain("Safety manual");
  });

  it("keeps Additional context optional when approved records are selected", async () => {
    render(<ContentStudioForm organizations={organizations} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "Workshop safety training" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Approved workshop safety" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate source script" }));
    await waitFor(() => expect(generateContentAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(generateContentAction).mock.calls[0]![0]).toEqual({
      organizationId: organizationOne,
      topic: "Workshop safety training",
      knowledgeRecordIds: [recordOne],
      language: "EN",
    });
  });

  it("does not render a misleading generation workspace when no eligible organization exists", () => {
    render(<ContentStudioForm organizations={[]} />);
    expect(screen.queryByRole("button", { name: "Generate source script" })).toBeNull();
  });

  it("keeps a safe generation failure visible and links to Settings for recovery", async () => {
    vi.mocked(generateContentAction).mockResolvedValue({ ok: false, error: "Content generation is temporarily unavailable." });
    render(<ContentStudioForm organizations={organizations} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "Workshop safety training" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate source script" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Content generation is temporarily unavailable.");
    expect(screen.getByRole("link", { name: /Open Settings/i }).getAttribute("href")).toBe("/settings");
  });

  it("shows safe provider and model metadata after successful generation", async () => {
    render(<ContentStudioForm organizations={organizations} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "Workshop safety training" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate source script" }));
    expect(await screen.findByText(/OpenAI · gpt-5.6-luna/i)).toBeTruthy();
  });
});
