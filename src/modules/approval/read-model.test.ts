import { describe, expect, it } from "vitest";

import {
  normalizeApprovalListQuery,
  toApprovalEvent,
  toApprovalQueueItem,
  type ApprovalRequestRow,
} from "./read-model";

const baseRow: ApprovalRequestRow = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  target_type: "CONTENT_ARTIFACT",
  target_id: "33333333-3333-4333-8333-333333333333",
  target_revision: 7,
  target_checksum: null,
  target_fingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  target_snapshot: {
    targetType: "CONTENT_ARTIFACT",
    artifactId: "33333333-3333-4333-8333-333333333333",
    contentItemId: "44444444-4444-4444-8444-444444444444",
    language: "EN",
    isSource: true,
    status: "GENERATED",
    revision: 7,
    sourceRevision: null,
    scriptText: "Exact reviewed script",
    topic: "Rail safety",
    signedUrl: "https://should-not-leak.example/token",
  },
  publication_intent: { channel: "SOCIAL" },
  status: "PENDING",
  requested_by: "55555555-5555-4555-8555-555555555555",
  requested_at: "2026-09-12T08:00:00.000Z",
  decided_by: null,
  decided_at: null,
  superseded_at: null,
  superseded_reason: null,
  created_at: "2026-09-12T08:00:00.000Z",
  updated_at: "2026-09-12T08:00:00.000Z",
};

describe("Approval Center read model", () => {
  it("normalizes queue filters with PENDING default and max page size 50", () => {
    expect(normalizeApprovalListQuery({ organizationId: baseRow.organization_id, limit: 500 })).toEqual({
      organizationId: baseRow.organization_id,
      status: "PENDING",
      limit: 50,
    });
  });

  it("maps content snapshots to a safe discriminated queue item", () => {
    const item = toApprovalQueueItem(baseRow);
    expect(item.target).toMatchObject({
      type: "CONTENT_ARTIFACT",
      contentItemId: "44444444-4444-4444-8444-444444444444",
      language: "EN",
      revision: 7,
      topic: "Rail safety",
    });
    expect(JSON.stringify(item)).not.toContain("signedUrl");
    expect(JSON.stringify(item)).not.toContain("storagePath");
  });

  it("maps media snapshots without exposing storage identity or signed credentials", () => {
    const item = toApprovalQueueItem({
      ...baseRow,
      target_type: "MEDIA_ASSET",
      target_revision: null,
      target_checksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      target_snapshot: {
        targetType: "MEDIA_ASSET",
        mediaAssetId: baseRow.target_id,
        assetType: "VIDEO",
        displayName: "Final master",
        mimeType: "video/mp4",
        checksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        storageBucket: "generated-media",
        storagePath: "private/path.mp4",
        signedUrl: "https://should-not-leak.example/token",
      },
    });
    expect(item.target).toMatchObject({ type: "MEDIA_ASSET", displayName: "Final master", assetType: "VIDEO" });
    expect(JSON.stringify(item)).not.toContain("storagePath");
    expect(JSON.stringify(item)).not.toContain("storageBucket");
    expect(JSON.stringify(item)).not.toContain("signedUrl");
  });

  it("maps immutable events to camelCase review history", () => {
    expect(toApprovalEvent({
      id: "66666666-6666-4666-8666-666666666666",
      organization_id: baseRow.organization_id,
      approval_request_id: baseRow.id,
      actor_kind: "USER",
      actor_user_id: baseRow.requested_by,
      event_type: "SUBMITTED",
      comment: null,
      target_revision: 7,
      target_checksum: null,
      created_at: baseRow.created_at,
    })).toMatchObject({
      requestId: baseRow.id,
      actorKind: "USER",
      eventType: "SUBMITTED",
      targetRevision: 7,
    });
  });
});
