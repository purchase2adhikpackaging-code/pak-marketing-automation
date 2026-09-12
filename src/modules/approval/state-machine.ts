import type { ApprovalDecision, ApprovalStatus } from "./types";

export type ApprovalDecisionStatus = Extract<
  ApprovalStatus,
  "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"
>;

export function canDecideApproval(status: ApprovalStatus): boolean {
  return status === "PENDING";
}

export function decisionStatus(decision: ApprovalDecision): ApprovalDecisionStatus {
  switch (decision) {
    case "APPROVE":
      return "APPROVED";
    case "REQUEST_CHANGES":
      return "CHANGES_REQUESTED";
    case "REJECT":
      return "REJECTED";
    default:
      throw new Error(`Unsupported approval decision: ${String(decision)}`);
  }
}
