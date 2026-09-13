import { describe, expect, it, vi } from "vitest";

import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_SOURCE_BYTES,
  extractKnowledgeText,
  type OfficeTextExtractor,
} from "./extractors";

describe("extractKnowledgeText", () => {
  it("decodes and sanitizes bounded UTF-8 TXT sources", async () => {
    const text = await extractKnowledgeText({
      format: "TXT",
      bytes: new TextEncoder().encode("PAK\u0000\r\nRailway   Academy\n\n\nTraining"),
    });

    expect(text).toBe("PAK\nRailway Academy\n\nTraining");
  });

  it("rejects oversized source bytes before parsing", async () => {
    await expect(extractKnowledgeText({
      format: "TXT",
      bytes: new Uint8Array(MAX_SOURCE_BYTES + 1),
    })).rejects.toThrow(/too large/i);
  });

  it("routes PDF/DOCX/PPTX through the bounded office parser adapter", async () => {
    const officeExtractor: OfficeTextExtractor = vi.fn().mockResolvedValue("  Railway\r\n\r\nOperations  ");

    for (const format of ["PDF", "DOCX", "PPTX"] as const) {
      await expect(extractKnowledgeText({
        format,
        bytes: new Uint8Array([1, 2, 3]),
      }, { officeExtractor })).resolves.toBe("Railway\n\nOperations");
    }

    expect(officeExtractor).toHaveBeenCalledTimes(3);
  });

  it("fails closed when extracted text is empty or exceeds the grounding limit", async () => {
    const empty: OfficeTextExtractor = vi.fn().mockResolvedValue(" \n \t ");
    await expect(extractKnowledgeText({ format: "PDF", bytes: new Uint8Array([1]) }, { officeExtractor: empty }))
      .rejects.toThrow(/no usable text/i);

    const huge: OfficeTextExtractor = vi.fn().mockResolvedValue("x".repeat(MAX_EXTRACTED_TEXT_CHARS + 1));
    await expect(extractKnowledgeText({ format: "DOCX", bytes: new Uint8Array([1]) }, { officeExtractor: huge }))
      .rejects.toThrow(/extracted text is too large/i);
  });
});