import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApprovalQueueItem } from "@/modules/approval/read-model";
import { listApprovalRequestsAction } from "./actions";
import { ApprovalCenterClient } from "./approval-center-client";

vi.mock("./actions", async () => {
  const actual = await vi.importActual<typeof import("./actions")>("./actions");
  return { ...actual, listApprovalRequestsAction: vi.fn() };
});

const organizationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

function item(): ApprovalQueueItem {
  return {
    id: requestId,
    organizationId,
    targetType: "CONTENT_ARTIFACT",
    targetId: "33333333-3333-4333-8333-333333333333",
    targetRevision: 4,
    targetFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    target: {
      type: "CONTENT_ARTIFACT",
      artifactId: "33333333-3333-4333-8333-333333333333",
      contentItemId: "44444444-4444-4444-8444-444444444444",
      language: "EN",
      isSource: true,
      status: "GENERATED",
      revision: 4,
      scriptText: "Exact script",
      topic: "Railway safety",
    },
    publicationIntent: {},
    status: "PENDING",
    requestedBy: "55555555-5555-4555-8555-555555555555",
    requestedAt: "2026-09-12T08:00:00.000Z",
    createdAt: "2026-09-12T08:00:00.000Z",
    updatedAt: "2026-09-12T08:00:00.000Z",
  };
}

const organizations = [{
  id: organizationId,
  label: "Polish Railway Academy",
  role: "REVIEWER" as const,
  initialPage: { items: [item()] },
  sceneReviewRequired: 2,
}];

describe("ApprovalCenterClient", () => {
  beforeEach(() => {
    vi.mocked(listApprovalRequestsAction).mockReset();
    vi.mocked(listApprovalRequestsAction).mockResolvedValue({ ok: true, page: { items: [] } });
  });

  it("renders operational tabs and keeps Scene Planning review separate", () => {
    render(<ApprovalCenterClient organizations={organizations} />);
    for (const label of ["Awaiting review", "Changes requested", "Approved", "Rejected", "Superseded"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Domain approval")).toBeInTheDocument();
    expect(screen.getByText(/2 scene plans require domain review/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open scene planning/i })).toHaveAttribute("href", "/scene-planning");
  });

  it("shows concise target identity and a stable detail route", () => {
    render(<ApprovalCenterClient organizations={organizations} />);
    expect(screen.getByText("Railway safety")).toBeInTheDocument();
    expect(screen.getByText(/EN · Revision 4/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review request/i })).toHaveAttribute(
      "href",
      `/approval-center/${requestId}?organization=${organizationId}`,
    );
  });

  it("loads a selected workflow tab through the guarded action", async () => {
    render(<ApprovalCenterClient organizations={organizations} />);
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    await waitFor(() => expect(listApprovalRequestsAction).toHaveBeenCalledWith({
      organizationId,
      status: "APPROVED",
      limit: 50,
    }));
    expect(await screen.findByText(/No approved requests/i)).toBeInTheDocument();
  });
});
