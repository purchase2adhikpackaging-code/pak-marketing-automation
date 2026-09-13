import { createHash } from "node:crypto";

import {
  extractKnowledgeText,
  type ExtractableKnowledgeFormat,
} from "./extractors";
import {
  fetchSafeKnowledgeUrl,
  type SafeKnowledgeUrlResult,
} from "./url-safety";

export type KnowledgeExtractionDependencies = {
  extractFileText: (input: {
    format: ExtractableKnowledgeFormat;
    bytes: Uint8Array;
  }) => Promise<string>;
  fetchUrlText: (url: string) => Promise<SafeKnowledgeUrlResult>;
};

export type KnowledgeExtractionInput =
  | {
      sourceType: "FILE";
      format: ExtractableKnowledgeFormat;
      bytes: Uint8Array;
    }
  | {
      sourceType: "URL";
      url: string;
    };

export type KnowledgeExtractionResult = {
  text: string;
  sourceFingerprint: string;
  canonicalUrl?: string;
};

const defaultDependencies: KnowledgeExtractionDependencies = {
  extractFileText: (input) => extractKnowledgeText(input),
  fetchUrlText: (url) => fetchSafeKnowledgeUrl(url),
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function extractKnowledgeSource(
  input: KnowledgeExtractionInput,
  dependencies: KnowledgeExtractionDependencies = defaultDependencies,
): Promise<KnowledgeExtractionResult> {
  if (input.sourceType === "FILE") {
    const text = await dependencies.extractFileText({
      format: input.format,
      bytes: input.bytes,
    });

    return {
      text,
      sourceFingerprint: sha256Hex(input.bytes),
    };
  }

  const fetched = await dependencies.fetchUrlText(input.url);
  return {
    text: fetched.text,
    sourceFingerprint: sha256Hex(fetched.bytes),
    canonicalUrl: fetched.canonicalUrl,
  };
}
