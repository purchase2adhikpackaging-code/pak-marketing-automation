import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import serverlessChromium from "@sparticuz/chromium";
import { chromium } from "playwright-core";

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

async function launchBrowser() {
  if (process.env.VERCEL) {
    return chromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true });
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

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(input.html, { waitUntil: "load" });
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

    await page.close();
  } finally {
    await browser.close();
  }

  return {
    pdfPath,
    pageImagePaths: [pageImagePath],
    htmlPath,
  };
}
