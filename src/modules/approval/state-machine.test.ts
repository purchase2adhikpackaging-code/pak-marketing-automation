import { describe, expect, it } from "vitest";

const stateMachineModulePath = "./state-machine";

async function loadStateMachine() {
  return import(stateMachineModulePath) as Promise<{
    canDecideApproval(status: string): boolean;
    decisionStatus(decision: string): string;
  }>;
}

describe("Approval Center state machine", () => {
  it("allows decisions only while a request is pending", async () => {
    const { canDecideApproval } = await loadStateMachine();

    expect(canDecideApproval("PENDING")).toBe(true);
    expect(canDecideApproval("CHANGES_REQUESTED")).toBe(false);
    expect(canDecideApproval("APPROVED")).toBe(false);
    expect(canDecideApproval("REJECTED")).toBe(false);
    expect(canDecideApproval("SUPERSEDED")).toBe(false);
  });

  it("maps explicit decisions to terminal review states", async () => {
    const { decisionStatus } = await loadStateMachine();

    expect(decisionStatus("APPROVE")).toBe("APPROVED");
    expect(decisionStatus("REQUEST_CHANGES")).toBe("CHANGES_REQUESTED");
    expect(decisionStatus("REJECT")).toBe("REJECTED");
  });

  it("rejects unknown decisions instead of inventing a workflow transition", async () => {
    const { decisionStatus } = await loadStateMachine();

    expect(() => decisionStatus("SUPERSEDE")).toThrow(/unsupported approval decision/i);
  });
});
