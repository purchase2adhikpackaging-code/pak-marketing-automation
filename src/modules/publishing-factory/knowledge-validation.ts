import type {
  KnowledgePack,
  KnowledgeSource,
} from "./knowledge-domain";

export type KnowledgeValidationCode =
  | "duplicate-source-id"
  | "unknown-source-id"
  | "unsafe-numeric-source-authority"
  | "duplicate-claim-id"
  | "duplicate-term"
  | "duplicate-pack-source-id";

export interface KnowledgeValidationFinding {
  code: KnowledgeValidationCode;
  message: string;
  path?: string;
}

const operationalAuthorities = new Set<KnowledgeSource["authority"]>([
  "eu-law",
  "era",
  "national-authority",
  "infrastructure-manager",
  "manufacturer",
]);

export function validateSourceRegistry(
  sources: readonly KnowledgeSource[],
): KnowledgeValidationFinding[] {
  const findings: KnowledgeValidationFinding[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.id)) {
      findings.push({
        code: "duplicate-source-id",
        message: `Duplicate knowledge source id: ${source.id}`,
        path: source.id,
      });
    }
    seen.add(source.id);
  }
  return findings;
}

function validateSourceIds(
  sourceIds: readonly string[],
  known: ReadonlyMap<string, KnowledgeSource>,
  path: string,
): KnowledgeValidationFinding[] {
  const findings: KnowledgeValidationFinding[] = [];
  for (const sourceId of sourceIds) {
    if (!known.has(sourceId)) {
      findings.push({
        code: "unknown-source-id",
        message: `Unknown knowledge source id: ${sourceId}`,
        path,
      });
    }
  }
  return findings;
}

export function validateKnowledgePack(
  pack: KnowledgePack,
  sources: readonly KnowledgeSource[],
): KnowledgeValidationFinding[] {
  const findings: KnowledgeValidationFinding[] = [];
  const known = new Map(sources.map((source) => [source.id, source] as const));

  findings.push(...validateSourceIds(pack.sourceIds, known, `${pack.id}.sourceIds`));

  const seenPackSourceIds = new Set<string>();
  for (const sourceId of pack.sourceIds) {
    if (seenPackSourceIds.has(sourceId)) {
      findings.push({
        code: "duplicate-pack-source-id",
        message: `Pack ${pack.id} repeats source id ${sourceId}.`,
        path: `${pack.id}.sourceIds`,
      });
    }
    seenPackSourceIds.add(sourceId);
  }

  const seenTerms = new Set<string>();
  for (const [index, term] of pack.canonicalTerminology.entries()) {
    const normalized = term.term.trim().toLowerCase();
    if (seenTerms.has(normalized)) {
      findings.push({
        code: "duplicate-term",
        message: `Pack ${pack.id} repeats canonical term ${term.term}.`,
        path: `${pack.id}.canonicalTerminology[${index}]`,
      });
    }
    seenTerms.add(normalized);
    findings.push(
      ...validateSourceIds(
        term.sourceIds,
        known,
        `${pack.id}.canonicalTerminology[${index}].sourceIds`,
      ),
    );
  }

  const seenClaims = new Set<string>();
  for (const [index, claim] of pack.claims.entries()) {
    if (seenClaims.has(claim.id)) {
      findings.push({
        code: "duplicate-claim-id",
        message: `Pack ${pack.id} repeats claim id ${claim.id}.`,
        path: `${pack.id}.claims[${index}]`,
      });
    }
    seenClaims.add(claim.id);
    findings.push(
      ...validateSourceIds(
        claim.sourceIds,
        known,
        `${pack.id}.claims[${index}].sourceIds`,
      ),
    );

    if (claim.safetyCritical && claim.numeric) {
      const authoritative = claim.sourceIds.some((sourceId) => {
        const source = known.get(sourceId);
        return source ? operationalAuthorities.has(source.authority) : false;
      });
      if (!authoritative) {
        findings.push({
          code: "unsafe-numeric-source-authority",
          message: `Safety-critical numeric claim ${claim.id} lacks an authoritative operational/legal source.`,
          path: `${pack.id}.claims[${index}]`,
        });
      }
    }
  }

  for (const [index, equation] of pack.equations.entries()) {
    findings.push(
      ...validateSourceIds(
        equation.sourceIds,
        known,
        `${pack.id}.equations[${index}].sourceIds`,
      ),
    );
  }

  return findings;
}
