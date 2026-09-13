import { describe, expect, it } from "vitest";

import { E2E_FIXTURE_HEADER, resolveE2EFixtureRole } from "./e2e-fixture";

describe("E2E fixture boundary", () => {
  it("activates only with the existing non-production auth bypass plus an exact fixture header", () => {
    expect(E2E_FIXTURE_HEADER).toBe("x-pak-e2e-fixture");
    expect(resolveE2EFixtureRole({
      nodeEnv: "test",
      bypassEnabled: "true",
      bypassHeaderValue: "allow",
      fixtureHeaderValue: "owner",
    })).toBe("OWNER");
    expect(resolveE2EFixtureRole({
      nodeEnv: "development",
      bypassEnabled: "true",
      bypassHeaderValue: "allow",
      fixtureHeaderValue: "reviewer",
    })).toBe("REVIEWER");
  });

  it("cannot activate in production or without every explicit gate", () => {
    const baseline = {
      nodeEnv: "test",
      bypassEnabled: "true",
      bypassHeaderValue: "allow",
      fixtureHeaderValue: "owner",
    };
    expect(resolveE2EFixtureRole({ ...baseline, nodeEnv: "production" })).toBeNull();
    expect(resolveE2EFixtureRole({ ...baseline, bypassEnabled: undefined })).toBeNull();
    expect(resolveE2EFixtureRole({ ...baseline, bypassHeaderValue: null })).toBeNull();
    expect(resolveE2EFixtureRole({ ...baseline, fixtureHeaderValue: null })).toBeNull();
    expect(resolveE2EFixtureRole({ ...baseline, fixtureHeaderValue: "admin" })).toBeNull();
  });
});
