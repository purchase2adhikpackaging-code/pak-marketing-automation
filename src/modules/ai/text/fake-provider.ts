import type { TextGenerationProvider } from "./provider";
import type { TextGenerationRequest, TextGenerationResult } from "./types";

export class FakeTextGenerationProvider implements TextGenerationProvider {
  readonly name = "fake";

  async validateConfiguration(): Promise<void> {
    return;
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return {
      text: `[${request.language}] ${request.topic}\n\nDeterministic PAK training content generated for automated testing.`,
      provider: this.name,
      model: "deterministic-v1",
    };
  }
}
