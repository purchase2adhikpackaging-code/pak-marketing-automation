import type { TextGenerationRequest, TextGenerationResult } from "./types";

export interface TextGenerationProvider {
  readonly name: string;
  validateConfiguration(): Promise<void>;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
