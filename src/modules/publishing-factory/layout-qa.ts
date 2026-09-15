import type { Page } from "@playwright/test";
import type { QaFinding } from "./domain";

interface RawLayoutIssue {
  defectClass: string;
  message: string;
  componentId?: string;
}

export async function runDomLayoutQa(page: Page): Promise<QaFinding[]> {
  const issues = await page.evaluate((tolerance) => {
    const results: RawLayoutIssue[] = [];

    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + tolerance) {
      results.push({
        defectClass: "page-horizontal-overflow",
        message: `Document scroll width ${root.scrollWidth}px exceeds client width ${root.clientWidth}px.`,
        componentId: "document-root",
      });
    }

    for (const element of document.querySelectorAll<HTMLElement>("[data-pak-box]")) {
      const boxRect = element.getBoundingClientRect();
      const componentId = element.dataset.pakBox || element.id || "unnamed-box";
      let foundOverflow = false;

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? "").trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          const escapesBox =
            rect.left < boxRect.left - tolerance ||
            rect.top < boxRect.top - tolerance ||
            rect.right > boxRect.right + tolerance ||
            rect.bottom > boxRect.bottom + tolerance;
          if (rect.width > 0 && rect.height > 0 && escapesBox) {
            results.push({
              defectClass: "internal-box-overflow",
              message: `Text escapes the bounds of ${componentId}.`,
              componentId,
            });
            foundOverflow = true;
            break;
          }
        }
        node = walker.nextNode();
      }

      if (foundOverflow) continue;

      for (const child of element.querySelectorAll<HTMLElement>("img, svg, table")) {
        const rect = child.getBoundingClientRect();
        const escapesBox =
          rect.left < boxRect.left - tolerance ||
          rect.top < boxRect.top - tolerance ||
          rect.right > boxRect.right + tolerance ||
          rect.bottom > boxRect.bottom + tolerance;
        if (rect.width > 0 && rect.height > 0 && escapesBox) {
          results.push({
            defectClass: "internal-box-overflow",
            message: `A visual/table element escapes the bounds of ${componentId}.`,
            componentId,
          });
          break;
        }
      }
    }

    const protectedElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pak-no-overlap]"),
    );
    for (let i = 0; i < protectedElements.length; i += 1) {
      const left = protectedElements[i];
      if (!left) continue;
      const leftRect = left.getBoundingClientRect();
      for (let j = i + 1; j < protectedElements.length; j += 1) {
        const right = protectedElements[j];
        if (!right) continue;
        const rightRect = right.getBoundingClientRect();
        const intersects =
          leftRect.left < rightRect.right - tolerance &&
          leftRect.right > rightRect.left + tolerance &&
          leftRect.top < rightRect.bottom - tolerance &&
          leftRect.bottom > rightRect.top + tolerance;
        if (intersects) {
          results.push({
            defectClass: "forbidden-element-overlap",
            message: "Elements marked data-pak-no-overlap visually intersect.",
            componentId: left.dataset.pakNoOverlap || left.id || `overlap-${i}`,
          });
        }
      }
    }

    for (const figure of document.querySelectorAll<HTMLElement>("figure[data-pak-figure]")) {
      const componentId = figure.dataset.pakFigure || figure.id || "unnamed-figure";
      if (!figure.querySelector("figcaption")) {
        results.push({
          defectClass: "figure-caption-missing",
          message: `Instructional figure ${componentId} has no figcaption.`,
          componentId,
        });
      }

      for (const image of figure.querySelectorAll<HTMLImageElement>("img")) {
        if (!image.alt.trim()) {
          results.push({
            defectClass: "instructional-image-alt-missing",
            message: `Instructional image in ${componentId} has empty alt text.`,
            componentId,
          });
        }
      }

      for (const svg of figure.querySelectorAll<SVGElement>('svg[role="img"]')) {
        if (!(svg.getAttribute("aria-label") ?? "").trim()) {
          results.push({
            defectClass: "instructional-image-alt-missing",
            message: `Instructional SVG in ${componentId} has no aria-label.`,
            componentId,
          });
        }
      }
    }

    return results;
  }, 0.5);

  return issues.map((issue, index) => ({
    id: `layout-qa-${index + 1}`,
    gate: "layout",
    defectClass: issue.defectClass,
    severity: "error",
    message: issue.message,
    detector: "dom-layout-qa",
    repairable: true,
    ...(issue.componentId ? { componentId: issue.componentId } : {}),
  }));
}
