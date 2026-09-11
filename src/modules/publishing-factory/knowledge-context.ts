import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { QualificationLevel } from "./domain";
import {
  KnowledgeSourceSchema,
  type KnowledgeClaim,
  type KnowledgePack,
  type KnowledgeSource,
} from "./knowledge-domain";
import {
  adaptKnowledgePack,
  getLevelProfile,
  type LevelProfile,
} from "./knowledge-adaptation";
import {
  getKnowledgePack,
  type LoadedKnowledgeRegistry,
} from "./knowledge-registry";

export interface SelectedKnowledgePack {
  packId: string;
  domain: string;
  title: string;
  revision: string;
  sha256: string;
  guidance: KnowledgePack["levelGuidance"][QualificationLevel];
}

export interface ContextTerminologyEntry {
  packId: string;
  domain: string;
  term: string;
  definition: string;
  sourceIds: string[];
}

export type ContextEquation = KnowledgePack["equations"][number] & {
  packId: string;
  domain: string;
};

export type ContextVisualSpec = KnowledgePack["visualSpecs"][number] & {
  packId: string;
  domain: string;
};

export interface ManuscriptKnowledgeContext {
  level: QualificationLevel;
  levelProfile: LevelProfile;
  selectedPacks: SelectedKnowledgePack[];
  canonicalTerminology: ContextTerminologyEntry[];
  claimsByDomain: Record<string, KnowledgeClaim[]>;
  equations: ContextEquation[];
  visualSpecs: ContextVisualSpec[];
  sourceRegister: KnowledgeSource[];
  prohibitedUnsupportedClaims: string[];
  safetyControls: {
    levelBoundary: string;
    rules: string[];
    safetyCriticalClaimIds: string[];
  };
}

function loadSources(root: string): KnowledgeSource[] {
  const path = resolve(root, "publishing/knowledge/sources/eu-era-core.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return KnowledgeSourceSchema.array().parse(raw);
}

function addSourceIds(target: Set<string>, ids: readonly string[]): void {
  for (const id of ids) target.add(id);
}

export function assembleKnowledgeContext(input: {
  packIds: readonly string[];
  level: QualificationLevel;
  registry: LoadedKnowledgeRegistry;
}): ManuscriptKnowledgeContext {
  const { packIds, level, registry } = input;
  const levelProfile = getLevelProfile(level);
  const selectedPacks: SelectedKnowledgePack[] = [];
  const canonicalTerminology: ContextTerminologyEntry[] = [];
  const claimsByDomain: Record<string, KnowledgeClaim[]> = {};
  const equations: ContextEquation[] = [];
  const visualSpecs: ContextVisualSpec[] = [];
  const prohibitedUnsupportedClaims: string[] = [];
  const prohibitedSeen = new Set<string>();
  const requiredSourceIds = new Set<string>();
  const safetyCriticalClaimIds: string[] = [];
  const seenPackIds = new Set<string>();

  for (const packId of packIds) {
    if (seenPackIds.has(packId)) {
      throw new Error(`Duplicate knowledge pack id in context request: ${packId}`);
    }
    seenPackIds.add(packId);

    const canonicalPack = getKnowledgePack(registry, packId);
    const loadedPack = registry.packs[packId];
    if (!loadedPack) {
      throw new Error(`Unknown knowledge pack id: ${packId}`);
    }
    const adapted = adaptKnowledgePack(canonicalPack, level);

    selectedPacks.push({
      packId: adapted.id,
      domain: adapted.domain,
      title: adapted.title,
      revision: adapted.revision,
      sha256: loadedPack.sha256,
      guidance: { ...adapted.guidance },
    });

    addSourceIds(requiredSourceIds, adapted.sourceIds);

    for (const term of adapted.canonicalTerminology) {
      addSourceIds(requiredSourceIds, term.sourceIds);
      canonicalTerminology.push({
        packId: adapted.id,
        domain: adapted.domain,
        term: term.term,
        definition: term.definition,
        sourceIds: [...term.sourceIds],
      });
    }

    claimsByDomain[adapted.domain] = adapted.claims.map((claim) => {
      addSourceIds(requiredSourceIds, claim.sourceIds);
      if (claim.safetyCritical) safetyCriticalClaimIds.push(claim.id);
      return { ...claim, sourceIds: [...claim.sourceIds] };
    });

    for (const equation of adapted.equations) {
      addSourceIds(requiredSourceIds, equation.sourceIds);
      equations.push({
        ...equation,
        variables: { ...equation.variables },
        sourceIds: [...equation.sourceIds],
        packId: adapted.id,
        domain: adapted.domain,
      });
    }

    for (const visual of adapted.visualSpecs) {
      visualSpecs.push({
        ...visual,
        labels: [...visual.labels],
        packId: adapted.id,
        domain: adapted.domain,
      });
    }

    for (const prohibited of adapted.prohibitedUnsupportedClaims) {
      if (!prohibitedSeen.has(prohibited)) {
        prohibitedSeen.add(prohibited);
        prohibitedUnsupportedClaims.push(prohibited);
      }
    }
  }

  const allSources = loadSources(registry.root);
  const sourceMap = new Map(allSources.map((source) => [source.id, source] as const));
  for (const sourceId of requiredSourceIds) {
    if (!sourceMap.has(sourceId)) {
      throw new Error(`Unknown knowledge source id: ${sourceId}`);
    }
  }
  const sourceRegister = allSources
    .filter((source) => requiredSourceIds.has(source.id))
    .map((source) => ({ ...source }));

  return {
    level,
    levelProfile: { ...levelProfile },
    selectedPacks,
    canonicalTerminology,
    claimsByDomain,
    equations,
    visualSpecs,
    sourceRegister,
    prohibitedUnsupportedClaims,
    safetyControls: {
      levelBoundary: levelProfile.safetyBoundary,
      rules: [
        "Training content does not confer operational, maintenance, inspection, design-approval or safety authorization.",
        "Do not introduce unsupported safety-critical numeric limits, tolerances, settings or acceptance values.",
        "Where operational use is contemplated, apply the current governing legal, infrastructure-manager, manufacturer and organisational controlled documents.",
      ],
      safetyCriticalClaimIds,
    },
  };
}
