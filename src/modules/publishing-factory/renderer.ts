import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import serverlessChromium from "@sparticuz/chromium";
import { chromium, type Page } from "playwright-core";

export interface RenderPublicationInput {
  bookId: string;
  html: string;
  artifactRoot: string;
}

export interface RenderPublicationResult {
  pdfPath: string;
  pageImagePaths: string[];
  htmlPath: string;
}

function assertInsideRoot(root: string, path: string): void {
  const normalizedRoot = `${resolve(root)}/`;
  const normalizedPath = resolve(path);
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Publishing artifact escaped configured root: ${normalizedPath}`);
  }
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production",
  );
}

export async function launchPublicationBrowser() {
  if (isServerlessRuntime()) {
    return chromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true });
}

async function waitForPublicationImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map(async (image) => {
        if (typeof image.decode === "function") {
          try {
            await image.decode();
          } catch {
            // The explicit complete/naturalWidth check below supplies a stable error.
          }
        }
        if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          const identity = image.getAttribute("data-visual-id") ?? image.alt ?? image.src.slice(0, 80);
          throw new Error(`Broken publication image: ${identity || "unidentified image"}`);
        }
      }),
    );
  });
}

export async function verifyPublicationBrowserRuntime(): Promise<void> {
  const browser = await launchPublicationBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    try {
      await page.setContent(
        "<!doctype html><html><head><meta charset=\"utf-8\"><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif}</style></head><body><main><h1>D01-101 Publishing Runtime Probe</h1><p>Deterministic HTML-to-PDF health check.</p></main></body></html>",
        { waitUntil: "load" },
      );
      await waitForPublicationImages(page);
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      if (pdf.byteLength < 1_000 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error("Publishing browser PDF probe returned an invalid PDF.");
      }
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

export async function renderPublication(
  input: RenderPublicationInput,
): Promise<RenderPublicationResult> {
  const artifactRoot = resolve(input.artifactRoot);
  const bookDir = join(artifactRoot, input.bookId);
  await mkdir(bookDir, { recursive: true });

  const htmlPath = join(bookDir, "source.html");
  const pdfPath = join(bookDir, `${input.bookId}.pdf`);
  const pageImagePath = join(bookDir, "page-001.png");

  for (const path of [htmlPath, pdfPath, pageImagePath]) {
    assertInsideRoot(artifactRoot, path);
  }

  await writeFile(htmlPath, input.html, "utf8");

  const browser = await launchPublicationBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    try {
      await page.setContent(input.html, { waitUntil: "load" });
      await waitForPublicationImages(page);
      await page.emulateMedia({ media: "print" });

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        outline: true,
      });

      await page.emulateMedia({ media: "screen" });
      await page.screenshot({
        path: pageImagePath,
        fullPage: true,
        animations: "disabled",
      });
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return {
    pdfPath,
    pageImagePaths: [pageImagePath],
    htmlPath,
  };
}
