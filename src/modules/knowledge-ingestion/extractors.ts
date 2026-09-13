export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_CHARS = 50_000;

export type ExtractableKnowledgeFormat = "PDF" | "DOCX" | "PPTX" | "TXT";
export type OfficeKnowledgeFormat = Exclude<ExtractableKnowledgeFormat, "TXT">;

export type OfficeTextExtractor = (input: {
  format: OfficeKnowledgeFormat;
  bytes: Uint8Array;
}) => Promise<string>;

function sanitizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function defaultOfficeExtractor(input: {
  format: OfficeKnowledgeFormat;
  bytes: Uint8Array;
}): Promise<string> {
  const { OfficeParser } = await import("officeparser");
  const ast = await OfficeParser.parseOffice(input.bytes, {
    fileType: input.format.toLowerCase() as "pdf" | "docx" | "pptx",
    extractAttachments: false,
    ocr: false,
    includeRawContent: false,
    ignoreComments: true,
    ignoreSlideMasters: true,
    decompressionLimits: {
      maxUncompressedBytes: 40 * 1024 * 1024,
      maxZipEntries: 5_000,
      maxTableCells: 100_000,
    },
  });
  const converted = await ast.to("text");
  return converted.value;
}

export async function extractKnowledgeText(
  input: {
    format: ExtractableKnowledgeFormat;
    bytes: Uint8Array;
  },
  dependencies: { officeExtractor?: OfficeTextExtractor } = {},
): Promise<string> {
  if (input.bytes.byteLength === 0) {
    throw new Error("Knowledge source contains no data.");
  }
  if (input.bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Knowledge source is too large.");
  }

  let rawText: string;
  if (input.format === "TXT") {
    try {
      rawText = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      throw new Error("Knowledge text source is not valid UTF-8.");
    }
  } else {
    const officeExtractor = dependencies.officeExtractor ?? defaultOfficeExtractor;
    rawText = await officeExtractor({ format: input.format, bytes: input.bytes });
  }

  const sanitized = sanitizeExtractedText(rawText);
  if (!sanitized) {
    throw new Error("Knowledge source contains no usable text.");
  }
  if (sanitized.length > MAX_EXTRACTED_TEXT_CHARS) {
    throw new Error("Extracted text is too large.");
  }

  return sanitized;
}
