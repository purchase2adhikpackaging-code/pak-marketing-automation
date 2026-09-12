import { describe, expect, it, vi } from "vitest";

import type { ApprovalDetail } from "@/modules/approval/read-model";
import {
  executeDecideApprovalAction,
  executeLoadApprovalDetailAction,
  executeListApprovalRequestsAction,
  executePreviewApprovalMediaAction,
  executeSubmitApprovalAction,
  type ApprovalCenterActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const checksum = `sha256:${"a".repeat(64)}`;

function mediaDetail(status: ApprovalDetail["status"] = "PENDING"): ApprovalDetail {
  return {
    id: requestId,
    organizationId,
    targetType: "MEDIA_ASSET",
    targetId,
    targetChecksum: checksum,
    targetFingerprint: `sha256:${"b".repeat(64)}`,
    target: {
      type: "MEDIA_ASSET",
      mediaAssetId: targetId,
      assetType: "VIDEO",
      displayName: "Review target",
      mimeType: "video/mp4",
      checksum,
      metadata: {},
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

function dependencies(role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST" | null): ApprovalCenterActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    getRole: vi.fn().mockResolvedValue(role),
    submit: vi.fn().mockResolvedValue(requestId),
    decide: vi.fn().mockResolvedValue({ approvalRequestId: requestId, status: "APPROVED", staleTarget: false }),
    list: vi.fn().mockResolvedValue({ items: [] }),
    getDetail: vi.fn().mockResolvedValue(null),
    previewMedia: vi.fn().mockResolvedValue({ mediaAssetId: targetId, signedUrl: "https://signed.example/asset", expiresInSeconds: 300 }),
  };
}

describe("Approval Center server actions", () => {
  it("rejects unauthenticated and non-member submission before invoking RPC", async () => {
    const anonymous = dependencies("EDITOR");
    anonymous.getActor = vi.fn().mockResolvedValue(null);
    expect((await executeSubmitApprovalAction({ organizationId, targetType: "MEDIA_ASSET", targetId }, anonymous)).ok).toBe(false);
    expect(anonymous.submit).not.toHaveBeenCalled();

    const noMembership = dependencies(null);
    expect((await executeSubmitApprovalAction({ organizationId, targetType: "MEDIA_ASSET", targetId }, noMembership)).ok).toBe(false);
    expect(noMembership.submit).not.toHaveBeenCalled();
  });

  it("allows OWNER/ADMIN/EDITOR submit, denies REVIEWER/ANALYST, and sends only IDs plus bounded context", async () => {
    const editor = dependencies("EDITOR");
    const result = await executeSubmitApprovalAction({
      organizationId,
      targetType: "CONTENT_ARTIFACT",
      targetId,
      publicationIntent: { channel: "SOCIAL" },
    }, editor);
    expect(result).toEqual({ ok: true, requestId });
    expect(editor.submit).toHaveBeenCalledWith({
      organizationId,
      targetType: "CONTENT_ARTIFACT",
      targetId,
      publicationIntent: { channel: "SOCIAL" },
    });

    for (const role of ["REVIEWER", "ANALYST"] as const) {
      const deps = dependencies(role);
      expect((await executeSubmitApprovalAction({ organizationId, targetType: "MEDIA_ASSET", targetId }, deps)).ok).toBe(false);
      expect(deps.submit).not.toHaveBeenCalled();
    }
  });

  it("allows OWNER/ADMIN/REVIEWER decisions, denies EDITOR/ANALYST, and validates required comments", async () => {
    const reviewer = dependencies("REVIEWER");
    expect((await executeDecideApprovalAction({ organizationId, requestId, decision: "APPROVE" }, reviewer)).ok).toBe(true);
    expect(reviewer.decide).toHaveBeenCalledWith({ organizationId, requestId, decision: "APPROVE" });

    const invalid = dependencies("OWNER");
    expect((await executeDecideApprovalAction({ organizationId, requestId, decision: "REJECT" }, invalid)).ok).toBe(false);
    expect(invalid.decide).not.toHaveBeenCalled();

    for (const role of ["EDITOR", "ANALYST"] as const) {
      const deps = dependencies(role);
      expect((await executeDecideApprovalAction({ organizationId, requestId, decision: "APPROVE" }, deps)).ok).toBe(false);
      expect(deps.decide).not.toHaveBeenCalled();
    }
  });

  it("permits queue/detail only to operational review roles and blocks ANALYST", async () => {
    const reviewer = dependencies("REVIEWER");
    expect((await executeListApprovalRequestsAction({ organizationId }, reviewer)).ok).toBe(true);
    expect((await executeLoadApprovalDetailAction({ organizationId, requestId }, reviewer)).ok).toBe(true);

    const analyst = dependencies("ANALYST");
    expect((await executeListApprovalRequestsAction({ organizationId }, analyst)).ok).toBe(false);
    expect((await executeLoadApprovalDetailAction({ organizationId, requestId }, analyst)).ok).toBe(false);
    expect(analyst.list).not.toHaveBeenCalled();
    expect(analyst.getDetail).not.toHaveBeenCalled();
  });

  it("binds approval media previews to the exact immutable request checksum and blocks superseded/analyst access", async () => {
    const reviewer = dependencies("REVIEWER");
    reviewer.getDetail = vi.fn().mockResolvedValue(mediaDetail());
    const allowed = await executePreviewApprovalMediaAction({ organizationId, requestId }, reviewer);
    expect(allowed.ok).toBe(true);
    expect(reviewer.previewMedia).toHaveBeenCalledWith({
      operation: "preview",
      organizationId,
      mediaAssetId: targetId,
      expectedChecksum: checksum,
    });

    const superseded = dependencies("REVIEWER");
    superseded.getDetail = vi.fn().mockResolvedValue(mediaDetail("SUPERSEDED"));
    expect((await executePreviewApprovalMediaAction({ organizationId, requestId }, superseded)).ok).toBe(false);
    expect(superseded.previewMedia).not.toHaveBeenCalled();

    const analyst = dependencies("ANALYST");
    analyst.getDetail = vi.fn().mockResolvedValue(mediaDetail());
    expect((await executePreviewApprovalMediaAction({ organizationId, requestId }, analyst)).ok).toBe(false);
    expect(analyst.previewMedia).not.toHaveBeenCalled();
  });

  it("fails malformed or oversized inputs safely before side effects", async () => {
    const deps = dependencies("OWNER");
    expect((await executeSubmitApprovalAction({ organizationId: "bad", targetType: "MEDIA_ASSET", targetId }, deps)).ok).toBe(false);
    expect((await executeSubmitApprovalAction({
      organizationId,
      targetType: "MEDIA_ASSET",
      targetId,
      publicationIntent: { note: "x".repeat(9000) },
    }, deps)).ok).toBe(false);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("returns safe user text for unexpected dependency failures", async () => {
    const deps = dependencies("OWNER");
    deps.submit = vi.fn().mockRejectedValue(new Error("SQL secret detail"));
    const result = await executeSubmitApprovalAction({ organizationId, targetType: "MEDIA_ASSET", targetId }, deps);
    expect(result).toEqual({ ok: false, error: "The approval request could not be submitted." });
    expect(JSON.stringify(result)).not.toContain("SQL secret detail");
  });
});
