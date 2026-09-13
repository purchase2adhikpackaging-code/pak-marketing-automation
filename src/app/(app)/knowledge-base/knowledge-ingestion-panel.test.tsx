import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../media-library/media-upload", () => ({
  MediaUpload: ({ accept, onUploaded }: { accept?: string; onUploaded: (id: string, file: { filename: string; mimeType: string }) => Promise<void> }) => (
    <div>
      <span data-testid="document-accept">{accept}</span>
      <button
        type="button"
        onClick={() => onUploaded(
          "22222222-2222-4222-8222-222222222222",
          { filename: "PAK-Safety.PDF", mimeType: "application/pdf" },
        )}
      >
        Simulate document upload
      </button>
    </div>
  ),
}));

vi.mock("./actions", () => ({
  ingestKnowledgeFileAction: vi.fn(),
  ingestKnowledgeUrlAction: vi.fn(),
}));

import { ingestKnowledgeFileAction, ingestKnowledgeUrlAction } from "./actions";
import { KnowledgeIngestionPanel } from "./knowledge-ingestion-panel";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const draftRecord: KnowledgeRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  organizationId,
  title: "PAK Safety",
  content: "Extracted source content",
  status: "DRAFT",
  sourceType: "DOCUMENT",
  revision: 1,
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

describe("KnowledgeIngestionPanel", () => {
  beforeEach(() => {
    vi.mocked(ingestKnowledgeFileAction).mockReset();
    vi.mocked(ingestKnowledgeUrlAction).mockReset();
  });

  it("reuses Media Library upload for only supported knowledge-document formats and creates a DRAFT for review", async () => {
    vi.mocked(ingestKnowledgeFileAction).mockResolvedValue({
      ok: true,
      documentId: "44444444-4444-4444-8444-444444444444",
      record: draftRecord,
    });
    const onIngested = vi.fn();

    render(<KnowledgeIngestionPanel organizationId={organizationId} onIngested={onIngested} />);

    expect(screen.getByTestId("document-accept").textContent).toContain(".pdf");
    expect(screen.getByTestId("document-accept").textContent).toContain(".docx");
    expect(screen.getByTestId("document-accept").textContent).toContain(".pptx");
    expect(screen.getByTestId("document-accept").textContent).toContain(".txt");

    fireEvent.change(screen.getByLabelText("Document source label"), { target: { value: "PAK Safety Manual" } });
    fireEvent.click(screen.getByRole("button", { name: "Simulate document upload" }));

    await waitFor(() => expect(ingestKnowledgeFileAction).toHaveBeenCalledWith({
      organizationId,
      mediaAssetId: "22222222-2222-4222-8222-222222222222",
      format: "PDF",
      sourceLabel: "PAK Safety Manual",
    }));
    expect(onIngested).toHaveBeenCalledWith(draftRecord);
    expect(await screen.findByText("Draft created for review. Activate it only after verifying the extracted content.")).toBeTruthy();
  });

  it("ingests a URL into DRAFT without exposing an activation shortcut", async () => {
    const urlRecord = { ...draftRecord, sourceType: "URL" as const, sourceReference: "https://example.org/programmes" };
    vi.mocked(ingestKnowledgeUrlAction).mockResolvedValue({
      ok: true,
      documentId: "55555555-5555-4555-8555-555555555555",
      record: urlRecord,
    });
    const onIngested = vi.fn();

    render(<KnowledgeIngestionPanel organizationId={organizationId} onIngested={onIngested} />);
    fireEvent.change(screen.getByLabelText("Knowledge URL"), { target: { value: "https://example.org/programmes" } });
    fireEvent.change(screen.getByLabelText("URL source label"), { target: { value: "PAK Programmes" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingest URL" }));

    await waitFor(() => expect(ingestKnowledgeUrlAction).toHaveBeenCalledWith({
      organizationId,
      sourceUrl: "https://example.org/programmes",
      sourceLabel: "PAK Programmes",
    }));
    expect(onIngested).toHaveBeenCalledWith(urlRecord);
    expect(screen.queryByRole("button", { name: /Activate/ })).toBeNull();
  });
});
