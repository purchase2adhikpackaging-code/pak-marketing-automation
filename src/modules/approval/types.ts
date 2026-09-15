export const APPROVAL_TARGET_TYPES = ["CONTENT_ARTIFACT", "MEDIA_ASSET"] as const;
export type ApprovalTargetType = (typeof APPROVAL_TARGET_TYPES)[number];

export const APPROVAL_STATUSES = [
  "PENDING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_EVENT_TYPES = [
  "SUBMITTED",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type ApprovalEventType = (typeof APPROVAL_EVENT_TYPES)[number];

export const APPROVAL_DECISIONS = ["APPROVE", "REQUEST_CHANGES", "REJECT"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export type SubmitApprovalInput = {
  organizationId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  publicationIntent?: Record<string, unknown>;
};

export type DecideApprovalInput = {
  organizationId: string;
  requestId: string;
  decision: ApprovalDecision;
  comment?: string;
};
