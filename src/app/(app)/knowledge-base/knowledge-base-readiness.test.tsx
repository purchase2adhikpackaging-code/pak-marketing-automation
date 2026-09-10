import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import { deleteKnowledgeAction } from "./actions";
import { KnowledgeBaseManager } from "./knowledge-base-manager";

vi.mock("./actions", () => ({
  archiveKnowledgeAction: vi.fn(),
  createKnowledgeAction: vi.fn(),
  deleteKnowledgeAction: vi.fn(),
  updateKnowledgeAction: vi.fn(),
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const record: KnowledgeRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId,
  title: "Approved safety standard",
  content: "Approved safety content",
  status: "ACTIVE",
  sourceType: "DOCUMENT",
  revision: 2,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

describe("Knowledge Base production readiness", () => {
  beforeEach(() => vi.mocked(deleteKnowledgeAction).mockReset());

  it("shows organization and role context plus a Content Studio workflow link", () => {
    render(
      <KnowledgeBaseManager
        organizations={[{ id: organizationId, label: "Polish Railway Academy", role: "OWNER", records: [] }]}
      />,
    );

    expect(screen.getByText("Polish Railway Academy")).toBeTruthy();
    expect(screen.getByText(/OWNER/)).toBeTruthy();
    expect(screen.getByText(/No Knowledge Base records are available/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Content Studio/i }).getAttribute("href")).toBe("/content-studio");
  });

  it("requires explicit confirmation before deleting a knowledge record", async () => {
    vi.mocked(deleteKnowledgeAction).mockResolvedValue({ ok: true });
    render(
      <KnowledgeBaseManager
        organizations={[{ id: organizationId, label: "Polish Railway Academy", role: "OWNER", records: [record] }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Approved safety standard" }));
    expect(deleteKnowledgeAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Approved safety standard" }));
    await waitFor(() => expect(deleteKnowledgeAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent(/deleted/i);
  });
});
