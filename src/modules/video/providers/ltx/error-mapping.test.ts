import { describe, expect, it } from "vitest";
import { mapLtxError } from "./error-mapping";

describe("LTX error mapping", () => {
  it.each([
    [400, "invalid_request_error", "LTX_INVALID_REQUEST", false],
    [401, "authentication_error", "LTX_AUTHENTICATION", false],
    [402, "insufficient_funds_error", "LTX_INSUFFICIENT_FUNDS", false],
    [404, "not_found_error", "LTX_NOT_FOUND", false],
    [422, "content_filtered_error", "LTX_CONTENT_FILTERED", false],
    [429, "rate_limit_error", "LTX_RATE_LIMITED", true],
    [429, "concurrency_limit_error", "LTX_RATE_LIMITED", true],
    [500, "api_error", "LTX_API_ERROR", true],
    [503, "service_unavailable", "LTX_SERVICE_UNAVAILABLE", true],
    [529, "overloaded_error", "LTX_OVERLOADED", true],
  ])("maps HTTP %i %s into normalized retry semantics", (status, providerType, code, retryable) => {
    expect(mapLtxError(status, { type: "error", error: { type: providerType, message: "Provider message" } })).toEqual({
      code,
      message: "Provider message",
      retryable,
    });
  });

  it("maps malformed provider errors to a safe normalized response", () => {
    expect(mapLtxError(502, { unexpected: true })).toEqual({
      code: "LTX_RESPONSE_INVALID",
      message: "LTX returned an invalid error response.",
      retryable: true,
    });
  });
});
