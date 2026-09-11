import { describe, expect, it } from "vitest";
import { classifyRetry } from "./retry-policy";

describe("video generation retry policy", () => {
  it("retries transient provider failures before the expensive-attempt cap", () => {
    expect(classifyRetry({ code: "LTX_RATE_LIMITED", retryable: true }, 1)).toEqual({
      retry: true,
      delaySeconds: 5,
    });
    expect(classifyRetry({ code: "LTX_API_ERROR", retryable: true }, 2)).toEqual({
      retry: true,
      delaySeconds: 15,
    });
    expect(classifyRetry({ code: "LTX_SERVICE_UNAVAILABLE", retryable: true }, 3)).toEqual({
      retry: true,
      delaySeconds: 45,
    });
  });

  it("never retries non-retryable failures", () => {
    expect(classifyRetry({ code: "LTX_CONTENT_FILTERED", retryable: false }, 1)).toEqual({ retry: false });
    expect(classifyRetry({ code: "LTX_AUTHENTICATION", retryable: false }, 1)).toEqual({ retry: false });
  });

  it("stops after four expensive generation attempts", () => {
    expect(classifyRetry({ code: "LTX_API_ERROR", retryable: true }, 4)).toEqual({ retry: false });
  });

  it("never automatically retries an ambiguous submission outcome", () => {
    expect(classifyRetry({ code: "LTX_SUBMISSION_UNKNOWN", retryable: true }, 1)).toEqual({ retry: false });
  });
});
