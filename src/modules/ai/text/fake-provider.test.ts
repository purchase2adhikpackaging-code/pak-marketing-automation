import { describe, expect, it } from "vitest";
import { FakeTextGenerationProvider } from "./fake-provider";

const request = {
  topic: "Railway safety training",
  knowledgeContext: "PAK workshop context",
  language: "EN" as const,
  systemInstructions: "Write a concise training script.",
  idempotencyKey: "content:123:script:v1",
};

describe("FakeTextGenerationProvider", () => {
  it("returns deterministic text", async () => {
    const provider = new FakeTextGenerationProvider();
    const first = await provider.generate(request);
    const second = await provider.generate(request);

    expect(first).toEqual(second);
    expect(first.provider).toBe("fake");
    expect(first.text.length).toBeGreaterThan(0);
  });
});
