import { readFile } from "node:fs/promises";
import type { QaFinding } from "./domain";

export interface PdfQaInput {
  pdfPath: string;
  expectedTitle: string;
  expectedIdentityText: string[];
  requireBookmarks: boolean;
}

interface PdfTextItem {
  str?: string;
}

function makeFinding(
  index: number,
  defectClass: string,
  message: string,
  page?: number,
): QaFinding {
  return {
    id: `pdf-qa-${index}`,
    gate: "pdf",
    defectClass,
    severity: "error",
    message,
    detector: "pdfjs-publication-qa",
    repairable: true,
    ...(page ? { page } : {}),
  };
}

function isA4(width: number, height: number): boolean {
  const expectedWidth = 595.28;
  const expectedHeight = 841.89;
  const tolerance = 3;
  return (
    Math.abs(width - expectedWidth) <= tolerance &&
    Math.abs(height - expectedHeight) <= tolerance
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function runPdfQa(input: PdfQaInput): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];
  let findingIndex = 1;
  let pdf: Awaited<ReturnType<typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"]>["promise"]> | undefined;

  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await readFile(input.pdfPath));
    pdf = await getDocument({ data }).promise;
  } catch (error) {
    return [
      makeFinding(
        findingIndex,
        "pdf-unreadable",
        `PDF could not be opened by PDF.js: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ];
  }

  try {
    if (pdf.numPages < 1) {
      findings.push(makeFinding(findingIndex++, "pdf-unreadable", "PDF contains no pages."));
      return findings;
    }

    const allPageText: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      if (!isA4(viewport.width, viewport.height)) {
        findings.push(
          makeFinding(
            findingIndex++,
            "wrong-page-size",
            `Page ${pageNumber} is ${viewport.width.toFixed(2)} × ${viewport.height.toFixed(2)} pt instead of A4.`,
            pageNumber,
          ),
        );
      }

      const textContent = await page.getTextContent();
      const pageText = normalizeText(
        textContent.items
          .map((item) => ("str" in item ? (item as PdfTextItem).str ?? "" : ""))
          .join(" "),
      );
      allPageText.push(pageText);

      if (!pageText) {
        const operators = await page.getOperatorList();
        if (operators.fnArray.length <= 3) {
          findings.push(
            makeFinding(
              findingIndex++,
              "blank-page",
              `Page ${pageNumber} contains neither searchable text nor meaningful drawing operators.`,
              pageNumber,
            ),
          );
        }
      }
    }

    const documentText = normalizeText(allPageText.join(" "));
    if (documentText.length < 20) {
      findings.push(
        makeFinding(
          findingIndex++,
          "missing-searchable-text",
          "PDF does not contain enough searchable/selectable text for a student publication.",
        ),
      );
    }

    for (const expected of input.expectedIdentityText) {
      if (!documentText.toLowerCase().includes(expected.toLowerCase())) {
        findings.push(
          makeFinding(
            findingIndex++,
            "identity-text-missing",
            `Expected publication identity text is missing: ${expected}`,
          ),
        );
      }
    }

    const metadata = await pdf.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    const actualTitle = typeof info.Title === "string" ? info.Title.trim() : "";
    if (actualTitle !== input.expectedTitle) {
      findings.push(
        makeFinding(
          findingIndex++,
          "metadata-mismatch",
          `Expected PDF title metadata "${input.expectedTitle}" but received "${actualTitle || "<empty>"}".`,
        ),
      );
    }

    if (input.requireBookmarks) {
      const outline = await pdf.getOutline();
      if (!outline || outline.length === 0) {
        findings.push(
          makeFinding(
            findingIndex++,
            "bookmark-navigation-missing",
            "Substantial textbook PDF has no document outline/bookmarks.",
          ),
        );
      }
    }

    return findings;
  } finally {
    await pdf.destroy();
  }
}
