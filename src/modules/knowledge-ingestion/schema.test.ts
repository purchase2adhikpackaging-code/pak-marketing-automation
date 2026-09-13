import { describe, expect, it } from "vitest";

import {
  createFileKnowledgeDocumentSchema,
  createUrlKnowledgeDocumentSchema,
  knowledgeDocumentExtractionStatusSchema,
  knowledgeDocumentFormatSchema,
} from "./schema";

describe("knowledge document lifecycle contracts", () => {
  it("accepts only the approved initial source formats", () => {
    for (const format of ["PDF", "DOCX", "PPTX", "TXT", "URL"]) {
      expect(knowledgeDocumentFormatSchema.safeParse(format).success).toBe(true);
    }
    for (const format of ["XLSX", "CSV", "OCR", "IMAGE"]) {
      expect(knowledgeDocumentFormatSchema.safeParse(format).success).toBe(false);
    }
  });

  it("uses explicit extraction lifecycle states", () => {
    for (const status of ["PENDING", "PROCESSING", "EXTRACTED", "FAILED"]) {
      expect(knowledgeDocumentExtractionStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(knowledgeDocumentExtractionStatusSchema.safeParse("ACTIVE").success).toBe(false);
  });

  it("accepts FILE ingestion only by Media Library document asset ID", () => {
    const parsed = createFileKnowledgeDocumentSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      mediaAssetId: "22222222-2222-4222-8222-222222222222",
      format: "PDF",
      sourceLabel: "PAK programme guide 2026",
    });
    expect(parsed.success).toBe(true);

    expect(createFileKnowledgeDocumentSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      mediaAssetId: "22222222-2222-4222-8222-222222222222",
      format: "URL",
      storagePath: "private/source.pdf",
    }).success).toBe(false);
  });

  it("accepts URL ingestion without browser-supplied extracted content or source identity", () => {
    const parsed = createUrlKnowledgeDocumentSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      sourceUrl: "https://example.org/railway-programmes",
      sourceLabel: "Official programme page",
    });
    expect(parsed.success).toBe(true);

    expect(createUrlKnowledgeDocumentSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      sourceUrl: "https://example.org/railway-programmes",
      extractedText: "trusted browser text",
      checksum: "browser-checksum",
      revision: 99,
    }).success).toBe(false);
  });
});