import "server-only";

import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import type {
  CreateFileDocumentInput,
  CreateUrlDocumentInput,
  FinalizeKnowledgeIngestionInput,
  KnowledgeIngestionFinalization,
  LoadedKnowledgeFileSource,
} from "./repository";
import { SupabaseKnowledgeIngestionRepository } from "./repository";
import { extractKnowledgeSource, type KnowledgeExtractionInput, type KnowledgeExtractionResult } from "./service";
import { validateKnowledgeSourceUrl } from "./url-safety";
import type { KnowledgeDocument, KnowledgeDocumentFormat } from "./types";

export type FileIngestionRequest = CreateFileDocumentInput;
export type UrlIngestionRequest = CreateUrlDocumentInput;

export interface KnowledgeIngestionRepositoryPort {
  loadFileSource(organizationId: string, mediaAssetId: string): Promise<LoadedKnowledgeFileSource>;
  createFileDocument(input: CreateFileDocumentInput): Promise<KnowledgeDocument>;
  createUrlDocument(input: CreateUrlDocumentInput): Promise<KnowledgeDocument>;
  markProcessing(
    id: string,
    organizationId: string,
    expectedRevision: number,
  ): Promise<KnowledgeDocument>;
  markFailed(
    id: string,
    organizationId: string,
    expectedRevision: number,
    errorSummary: string,
  ): Promise<void>;
  finalize(input: FinalizeKnowledgeIngestionInput): Promise<KnowledgeIngestionFinalization>;
}

export type KnowledgeIngestionServiceDependencies = {
  extractSource(input: KnowledgeExtractionInput): Promise<KnowledgeExtractionResult>;
  validateUrl(url: string): Promise<string>;
};

const MIME_BY_FORMAT: Record<Exclude<KnowledgeDocumentFormat, "URL">, readonly string[]> = {
  PDF: ["application/pdf"],
  DOCX: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  PPTX: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  TXT: ["text/plain"],
};

function normalizedMime(value: string): string {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}

function assertMimeMatchesFormat(
  source: LoadedKnowledgeFileSource,
  format: Exclude<KnowledgeDocumentFormat, "URL">,
): void {
  const allowed = MIME_BY_FORMAT[format];
  if (!allowed.includes(normalizedMime(source.mimeType))) {
    throw new Error("Knowledge document MIME type does not match the requested format.");
  }
}

function fileTitle(source: LoadedKnowledgeFileSource, label?: string): string {
  const supplied = label?.trim();
  if (supplied) return supplied;
  const stripped = source.displayName.replace(/\.(pdf|docx|pptx|txt)$/i, "").trim();
  return stripped || "Knowledge document";
}

function urlTitle(canonicalUrl: string, label?: string): string {
  const supplied = label?.trim();
  if (supplied) return supplied;
  const hostname = new URL(canonicalUrl).hostname.replace(/^www\./i, "");
  return hostname || "Knowledge URL";
}

async function markExtractionFailure(
  repository: KnowledgeIngestionRepositoryPort,
  document: KnowledgeDocument,
): Promise<void> {
  try {
    await repository.markFailed(
      document.id,
      document.organizationId,
      document.revision,
      "Extraction failed.",
    );
  } catch {
    // Preserve the original extraction failure. A concurrent state transition may
    // legitimately make the best-effort FAILED marker lose its revision race.
  }
}

export class KnowledgeIngestionService {
  constructor(
    private readonly repository: KnowledgeIngestionRepositoryPort,
    private readonly dependencies: KnowledgeIngestionServiceDependencies,
  ) {}

  async ingestFile(input: FileIngestionRequest): Promise<{ documentId: string; record: KnowledgeRecord }> {
    const source = await this.repository.loadFileSource(input.organizationId, input.mediaAssetId);
    assertMimeMatchesFormat(source, input.format);

    const pending = await this.repository.createFileDocument(input);
    const processing = await this.repository.markProcessing(
      pending.id,
      pending.organizationId,
      pending.revision,
    );

    let extracted: KnowledgeExtractionResult;
    try {
      extracted = await this.dependencies.extractSource({
        sourceType: "FILE",
        format: input.format,
        bytes: source.bytes,
      });
    } catch (error) {
      await markExtractionFailure(this.repository, processing);
      throw error;
    }

    const finalized = await this.repository.finalize({
      documentId: processing.id,
      organizationId: processing.organizationId,
      expectedRevision: processing.revision,
      title: fileTitle(source, input.sourceLabel),
      content: extracted.text,
      sourceType: "DOCUMENT",
      sourceReference: `media:${input.mediaAssetId}`,
      sourceFingerprint: extracted.sourceFingerprint,
      extractionMetadata: {
        format: input.format,
        mimeType: normalizedMime(source.mimeType),
        sourceBytes: source.bytes.byteLength,
      },
    });

    if (finalized.record.status !== "DRAFT") {
      throw new Error("Knowledge ingestion produced an invalid lifecycle state.");
    }

    return { documentId: finalized.document.id, record: finalized.record };
  }

  async ingestUrl(input: UrlIngestionRequest): Promise<{ documentId: string; record: KnowledgeRecord }> {
    const canonicalInputUrl = await this.dependencies.validateUrl(input.sourceUrl);
    const pending = await this.repository.createUrlDocument({
      ...input,
      sourceUrl: canonicalInputUrl,
    });
    const processing = await this.repository.markProcessing(
      pending.id,
      pending.organizationId,
      pending.revision,
    );

    let extracted: KnowledgeExtractionResult;
    try {
      extracted = await this.dependencies.extractSource({
        sourceType: "URL",
        url: canonicalInputUrl,
      });
    } catch (error) {
      await markExtractionFailure(this.repository, processing);
      throw error;
    }

    const canonicalSourceUrl = extracted.canonicalUrl ?? canonicalInputUrl;
    const finalized = await this.repository.finalize({
      documentId: processing.id,
      organizationId: processing.organizationId,
      expectedRevision: processing.revision,
      title: urlTitle(canonicalSourceUrl, input.sourceLabel),
      content: extracted.text,
      sourceType: "URL",
      sourceReference: canonicalSourceUrl,
      sourceFingerprint: extracted.sourceFingerprint,
      extractionMetadata: {
        format: "URL",
        requestedUrl: canonicalInputUrl,
        canonicalUrl: canonicalSourceUrl,
      },
    });

    if (finalized.record.status !== "DRAFT") {
      throw new Error("Knowledge ingestion produced an invalid lifecycle state.");
    }

    return { documentId: finalized.document.id, record: finalized.record };
  }
}

export function createProductionKnowledgeIngestionService(): KnowledgeIngestionService {
  return new KnowledgeIngestionService(new SupabaseKnowledgeIngestionRepository(), {
    extractSource: (input) => extractKnowledgeSource(input),
    validateUrl: (url) => validateKnowledgeSourceUrl(url),
  });
}
