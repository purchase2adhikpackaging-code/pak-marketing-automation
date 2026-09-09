import { describe, expect, it } from "vitest";
import { canTransitionJobState } from "./state-machine";

const allowed: Array<[string, string]> = [
  ["QUEUED", "PROCESSING"],
  ["PROCESSING", "COMPLETED"],
  ["PROCESSING", "FAILED"],
  ["FAILED", "RETRYING"],
  ["RETRYING", "QUEUED"],
  ["QUEUED", "CANCELLED"],
  ["PROCESSING", "CANCELLED"],
];

describe("canTransitionJobState", () => {
  it.each(allowed)("allows %s -> %s", (from, to) => {
    expect(canTransitionJobState(from as never, to as never)).toBe(true);
  });

  it("rejects terminal state transitions", () => {
    expect(canTransitionJobState("COMPLETED", "PROCESSING")).toBe(false);
    expect(canTransitionJobState("CANCELLED", "QUEUED")).toBe(false);
  });

  it("rejects skipping processing", () => {
    expect(canTransitionJobState("QUEUED", "COMPLETED")).toBe(false);
  });
});
