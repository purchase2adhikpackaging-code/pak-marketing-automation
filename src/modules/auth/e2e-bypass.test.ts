import { describe, expect, it } from "vitest";

import { canBypassAuthForE2E } from "./e2e-bypass";

describe("canBypassAuthForE2E", () => {
  it("allows the explicit request-scoped bypass only outside production", () => {
    expect(
      canBypassAuthForE2E({
        nodeEnv: "development",
        bypassEnabled: "true",
        headerValue: "allow",
      }),
    ).toBe(true);
  });

  it("never allows the E2E bypass in production", () => {
    expect(
      canBypassAuthForE2E({
        nodeEnv: "production",
        bypassEnabled: "true",
        headerValue: "allow",
      }),
    ).toBe(false);
  });

  it("rejects a missing, disabled, or incorrect request header", () => {
    expect(
      canBypassAuthForE2E({
        nodeEnv: "development",
        bypassEnabled: "true",
        headerValue: null,
      }),
    ).toBe(false);

    expect(
      canBypassAuthForE2E({
        nodeEnv: "development",
        bypassEnabled: "false",
        headerValue: "allow",
      }),
    ).toBe(false);

    expect(
      canBypassAuthForE2E({
        nodeEnv: "development",
        bypassEnabled: "true",
        headerValue: "wrong",
      }),
    ).toBe(false);
  });
});
