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
}));

const organizationId = "11111111-1111-4111-8111-111111111111";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId,
    title: "Workshop safety standard",
    content: "Approved PAK workshop safety information.",
    status: "ACTIVE",
    sourceType: "DOCUMENT",
    isCore: false,
    revision: 4,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

function renderManager(role: AppRole, records: KnowledgeRecord[] = [record()]) {
  return render(
    <KnowledgeBaseManager
      organizations={[{ id: organizationId, label: "PAK Poland", role, records }]}
    />,
  );
}

describe("KnowledgeBaseManager Core Knowledge controls", () => {
  beforeEach(() => {
    vi.mocked(setCoreKnowledgeAction).mockReset();
  });

  it.each(["OWNER", "ADMIN"] as const)("allows %s to mark a record as Core with CAS revision", async (role) => {
    const existing = record();
    vi.mocked(setCoreKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({ isCore: true, revision: 5 }),
    });
    renderManager(role, [existing]);

    fireEvent.click(screen.getByRole("button", { name: "Mark Workshop safety standard as Core" }));

    await waitFor(() => {
      expect(setCoreKnowledgeAction).toHaveBeenCalledWith({
        id: existing.id,
        organizationId,
        expectedRevision: 4,
        isCore: true,
      });
    });
    expect(await screen.findByText("Core Knowledge")).toBeTruthy();
  });

  it("allows an admin to remove Core status using the current revision", async () => {
    const existing = record({ isCore: true, revision: 7 });
    vi.mocked(setCoreKnowledgeAction).mockResolvedValue({
      ok: true,
      record: record({ isCore: false, revision: 8 }),
    });
    renderManager("ADMIN", [existing]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Workshop safety standard from Core" }));

    await waitFor(() => {
      expect(setCoreKnowledgeAction).toHaveBeenCalledWith({
        id: existing.id,
        organizationId,
        expectedRevision: 7,
        isCore: false,
      });
    });
  });

  it("does not expose Core mutation controls to editors", () => {
    renderManager("EDITOR");

    expect(screen.queryByRole("button", { name: /Core/ })).toBeNull();
    expect(setCoreKnowledgeAction).not.toHaveBeenCalled();
  });
});
