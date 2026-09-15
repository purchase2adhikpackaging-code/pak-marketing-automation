import { createHash } from "node:crypto";
import type { BookJob, QaFinding } from "./domain";

export type RepairStage = "manuscript" | "references" | "visual" | "typesetting" | "export";

const MAX_AUTOMATIC_REPAIRS = 3;

function normalize(value: string | number | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function defectSignature(finding: QaFinding): string {
  const payload = [
    finding.gate,
    finding.defectClass,
    normalize(finding.page),
    normalize(finding.componentId),
    normalize(finding.message),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function routeRepair(finding: QaFinding): RepairStage {
  if (finding.defectClass === "unsupported-safety-critical-value" || finding.gate === "references" || finding.gate === "safety") {
    return "references";
  }
  if (finding.defectClass === "low-effective-dpi" || finding.gate === "visual-assets" || finding.gate === "render-vision") {
    return "visual";
  }
  if (
    finding.defectClass.includes("overflow") ||
    finding.defectClass.includes("overlap") ||
    finding.gate === "layout"
  ) {
    return "typesetting";
  }
  if (finding.gate === "pdf" || finding.defectClass.includes("metadata") || finding.defectClass.includes("bookmark")) {
    return "export";
  }
  return "manuscript";
}

export function shouldBlockAfterAttempt(job: BookJob, finding: QaFinding): boolean {
  const signature = defectSignature(finding);
  return (job.repairAttempts[signature] ?? 0) >= MAX_AUTOMATIC_REPAIRS;
}

export function recordRepairAttempt(job: BookJob, finding: QaFinding): BookJob {
  const signature = defectSignature(finding);
  const current = job.repairAttempts[signature] ?? 0;
  if (current >= MAX_AUTOMATIC_REPAIRS) {
    throw new Error(`Maximum automatic repair attempts reached for defect ${signature}`);
  }

  return {
    ...job,
    repairAttempts: {
      ...job.repairAttempts,
      [signature]: current + 1,
    },
    updatedAt: new Date().toISOString(),
  };
}

export const repairPolicy = {
  maxAutomaticAttempts: MAX_AUTOMATIC_REPAIRS,
} as const;
