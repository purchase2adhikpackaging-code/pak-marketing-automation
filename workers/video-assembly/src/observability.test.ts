import { describe, expect, it } from "vitest";

import { safeWorkerLogError } from "./observability.js";

describe("final assembly worker observability", () => {
  it("logs normalized worker error metadata without leaking arbitrary messages", () => {
    const normalized = safeWorkerLogError({
      code: "EDGE_UNAVAILABLE",
      retryable: true,
      message: "Bearer super-secret-token https://signed.example/object?token=secret",
    });

    expect(normalized).toEqual({ code: "EDGE_UNAVAILABLE", retryable: true });
    expect(JSON.stringify(normalized)).not.toContain("super-secret-token");
    expect(JSON.stringify(normalized)).not.toContain("signed.example");
  });

  it("falls back to a generic safe code for unknown errors", () => {
    const normalized = safeWorkerLogError(new Error("PAK_RENDER_WORKER_TOKEN=do-not-log"));

    expect(normalized).toEqual({ code: "WORKER_INTERNAL", retryable: true });
    expect(JSON.stringify(normalized)).not.toContain("do-not-log");
  });
});
