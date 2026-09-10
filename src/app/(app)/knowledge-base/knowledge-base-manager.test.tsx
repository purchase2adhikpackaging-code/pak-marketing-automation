import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import {
  archiveKnowledgeAction,
  createKnowledgeAction,
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from "./actions";
import { KnowledgeBaseManager } from "./knowledge-base-manager";

vi.mock("./actions", () => ({
  archiveKnowledgeAction: vi.fn(),
  createKnowledgeAction: vi.fn(),
  deleteKnowledgeAction: vi.fn(),
  updateKnowledgeAction: vi.fn(),
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
  });

  it("renders record status, revision, source metadata, and updated time", () => {
    renderManager();

    expect(screen.getByText("Workshop safety standard")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("Revision 4")).toBeTruthy();
    expect(screen.getByText("PAK Safety Manual")).toBeTruthy();
    expect(screen.getByText("Section 4.2")).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it("shows a plain create form for users with knowledge:manage", () => {
    renderManager("EDITOR");

    expect(screen.getByRole("heading", { name: "Add knowledge record" })).toBeTruthy();
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Content").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Source type")).toBeTruthy();
    expect(screen.getByLabelText("Source label")).toBeTruthy();
    expect(screen.getByLabelText("Source reference")).toBeTruthy();
  });

  it("allows editors to manage records but hides delete controls", () => {
    renderManager("EDITOR");

    expect(screen.getByRole("button", { name: "Edit Workshop safety standard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Workshop safety standard" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Workshop safety standard" })).toBeNull();
  });

  it.each(["OWNER", "ADMIN"] as const)("shows delete control to %s", (role) => {
    renderManager(role);

    expect(screen.getByRole("button", { name: "Delete Workshop safety standard" })).toBeTruthy();
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
    expect(screen.queryByRole("heading", { name: "Add knowledge record" })).toBeNull();
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
        }),
      );
    });
  });

  it("edits source type, label, and reference with the current revision", async () => {
    vi.mocked(updateKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({
        sourceType: "URL",
        sourceLabel: "PAK Portal",
        sourceReference: "https://pak.example/source",
        revision: 5,
      }),
    });
    renderManager("EDITOR");

    fireEvent.click(screen.getByRole("button", { name: "Edit Workshop safety standard" }));
    fireEvent.change(screen.getByLabelText("Edit source type"), { target: { value: "URL" } });
    fireEvent.change(screen.getByLabelText("Edit source label"), { target: { value: "PAK Portal" } });
    fireEvent.change(screen.getByLabelText("Edit source reference"), {
      target: { value: "https://pak.example/source" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Workshop safety standard" }));

    await waitFor(() => {
      expect(updateKnowledgeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedRevision: 4,
          sourceType: "URL",
          sourceLabel: "PAK Portal",
          sourceReference: "https://pak.example/source",
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
