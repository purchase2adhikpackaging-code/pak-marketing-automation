import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import {
  archiveKnowledgeAction,
  createKnowledgeAction,
  deleteKnowledgeAction,
  setCoreKnowledgeAction,
  updateKnowledgeAction,
} from "./actions";
import { KnowledgeBaseManager } from "./knowledge-base-manager";

vi.mock("./actions", () => ({
  archiveKnowledgeAction: vi.fn(),
  createKnowledgeAction: vi.fn(),
  deleteKnowledgeAction: vi.fn(),
  setCoreKnowledgeAction: vi.fn(),
  updateKnowledgeAction: vi.fn(),
  ingestKnowledgeFileAction: vi.fn(),
  ingestKnowledgeUrlAction: vi.fn(),
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-09T00:00:00.000Z";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId,
    title: "Workshop safety standard",
    content: "Approved PAK workshop safety information.",
    status: "ACTIVE",
    sourceType: "DOCUMENT",
    sourceLabel: "PAK Safety Manual",
    sourceReference: "Section 4.2",
    revision: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function renderManager(role: AppRole = "EDITOR", records: KnowledgeRecord[] = [record()]) {
  return render(
    <KnowledgeBaseManager
      organizations={[
        {
          id: organizationId,
          label: "PAK Poland",
          role,
          records,
        },
      ]}
    />,
  );
}

describe("KnowledgeBaseManager", () => {
  beforeEach(() => {
    vi.mocked(createKnowledgeAction).mockReset();
    vi.mocked(updateKnowledgeAction).mockReset();
    vi.mocked(archiveKnowledgeAction).mockReset();
    vi.mocked(deleteKnowledgeAction).mockReset();
    vi.mocked(setCoreKnowledgeAction).mockReset();
  });

  it("renders authoritative record status, revision, source metadata, and updated time", () => {
    renderManager();

    expect(screen.getByText("Workshop safety standard")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("Revision 4")).toBeTruthy();
    expect(screen.getByText("DOCUMENT")).toBeTruthy();
    expect(screen.getByText("PAK Safety Manual")).toBeTruthy();
    expect(screen.getByText("Section 4.2")).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it("separates manual entry from ingestion and explains DRAFT to ACTIVE approval lifecycle", () => {
    renderManager("EDITOR");

    expect(screen.getByRole("heading", { name: "Add manually" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ingest document or URL" })).toBeTruthy();
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Content").tagName).toBe("TEXTAREA");
    expect(screen.queryByLabelText("Source type")).toBeNull();
    expect(screen.getByLabelText("Source label")).toBeTruthy();
    expect(screen.getByLabelText("Source reference")).toBeTruthy();
    expect(screen.getByText(/DRAFT records require human review/i)).toBeTruthy();
    expect(screen.getByText(/ACTIVE records are approved for generation/i)).toBeTruthy();
  });

  it("always creates manual form records with sourceType MANUAL", async () => {
    const manualDraft = record({
      title: "Manual programme note",
      content: "Operator-entered programme context.",
      status: "DRAFT",
      sourceType: "MANUAL",
      sourceLabel: "Admissions desk",
      sourceReference: "Internal briefing",
      revision: 1,
    });
    vi.mocked(createKnowledgeAction).mockResolvedValue({ ok: true, record: manualDraft });
    renderManager("EDITOR", []);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: manualDraft.title } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: manualDraft.content } });
    fireEvent.change(screen.getByLabelText("Source label"), { target: { value: manualDraft.sourceLabel } });
    fireEvent.change(screen.getByLabelText("Source reference"), { target: { value: manualDraft.sourceReference } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(createKnowledgeAction).toHaveBeenCalledWith({
      organizationId,
      title: manualDraft.title,
      content: manualDraft.content,
      sourceType: "MANUAL",
      sourceLabel: manualDraft.sourceLabel,
      sourceReference: manualDraft.sourceReference,
    }));
    expect(await screen.findByText(/Draft created for review/i)).toBeTruthy();
  });

  it("allows editors to manage records but hides delete and Core mutation controls", () => {
    renderManager("EDITOR");

    expect(screen.getByRole("button", { name: "Edit Workshop safety standard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Workshop safety standard" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Workshop safety standard" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark Workshop safety standard as Core" })).toBeNull();
  });

  it.each(["OWNER", "ADMIN"] as const)("shows delete and Core mutation controls to %s", (role) => {
    renderManager(role);

    expect(screen.getByRole("button", { name: "Delete Workshop safety standard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark Workshop safety standard as Core" })).toBeTruthy();
  });

  it("explains that Core Knowledge is automatically grounded in generation", () => {
    renderManager("OWNER", [record({ isCore: true })]);

    expect(screen.getByText("Core Knowledge")).toBeTruthy();
    expect(screen.getByText("Automatically grounded in generation.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Workshop safety standard from Core" })).toBeTruthy();
  });

  it.each(["REVIEWER", "ANALYST"] as const)("renders %s as ACTIVE-only read-only view", (role) => {
    renderManager(role, [
      record(),
      record({
        id: "33333333-3333-4333-8333-333333333333",
        title: "Draft internal note",
        status: "DRAFT",
      }),
      record({
        id: "44444444-4444-4444-8444-444444444444",
        title: "Archived source",
        status: "ARCHIVED",
      }),
    ]);

    expect(screen.getByText("Workshop safety standard")).toBeTruthy();
    expect(screen.queryByText("Draft internal note")).toBeNull();
    expect(screen.queryByText("Archived source")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Add manually" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Ingest document or URL" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.getByText("Read-only approved knowledge")).toBeTruthy();
  });

  it("allows a manager to activate a draft record", async () => {
    const draft = record({ status: "DRAFT" });
    vi.mocked(updateKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({ status: "ACTIVE", revision: 5 }),
    });
    renderManager("EDITOR", [draft]);

    fireEvent.click(screen.getByRole("button", { name: "Activate Workshop safety standard" }));

    await waitFor(() => {
      expect(updateKnowledgeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: draft.id,
          organizationId,
          expectedRevision: 4,
          status: "ACTIVE",
          sourceType: "DOCUMENT",
        }),
      );
    });
  });

  it("preserves an ingested record's authoritative source type while editing metadata", async () => {
    vi.mocked(updateKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({
        sourceLabel: "Updated Safety Manual",
        sourceReference: "Section 5.1",
        revision: 5,
      }),
    });
    renderManager("EDITOR");

    fireEvent.click(screen.getByRole("button", { name: "Edit Workshop safety standard" }));
    expect(screen.queryByLabelText("Edit source type")).toBeNull();
    expect(screen.getByText("Source type: DOCUMENT")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Edit source label"), { target: { value: "Updated Safety Manual" } });
    fireEvent.change(screen.getByLabelText("Edit source reference"), { target: { value: "Section 5.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Workshop safety standard" }));

    await waitFor(() => {
      expect(updateKnowledgeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedRevision: 4,
          sourceType: "DOCUMENT",
          sourceLabel: "Updated Safety Manual",
          sourceReference: "Section 5.1",
        }),
      );
    });
  });

  it("submits the current revision when editing an existing record", async () => {
    vi.mocked(updateKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({ title: "Updated safety standard", revision: 5 }),
    });
    renderManager("EDITOR");

    fireEvent.click(screen.getByRole("button", { name: "Edit Workshop safety standard" }));
    const titleInput = screen.getByLabelText("Edit title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Updated safety standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Workshop safety standard" }));

    await waitFor(() => {
      expect(updateKnowledgeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: record().id,
          organizationId,
          expectedRevision: 4,
          title: "Updated safety standard",
          sourceType: "DOCUMENT",
        }),
      );
    });
  });

  it("displays safe action errors", async () => {
    vi.mocked(archiveKnowledgeAction).mockResolvedValue({
      ok: false,
      error: "This Knowledge Base record changed before your update completed. Refresh and try again.",
    });
    renderManager("EDITOR");

    fireEvent.click(screen.getByRole("button", { name: "Archive Workshop safety standard" }));

    expect(
      await screen.findByText(
        "This Knowledge Base record changed before your update completed. Refresh and try again.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("database password");
  });
});
