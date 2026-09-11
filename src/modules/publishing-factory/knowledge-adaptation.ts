import type { QualificationLevel } from "./domain";
import type { KnowledgePack } from "./knowledge-domain";

export interface LevelProfile {
  level: QualificationLevel;
  rank: number;
  purpose: string;
  safetyBoundary: string;
}

export interface AdaptedKnowledgePack extends KnowledgePack {
  level: QualificationLevel;
  guidance: KnowledgePack["levelGuidance"][QualificationLevel];
  levelProfile: LevelProfile;
}

const profiles: Record<QualificationLevel, LevelProfile> = {
  certificate: {
    level: "certificate",
    rank: 1,
    purpose: "Awareness, terminology, recognition and system understanding.",
    safetyBoundary: "No independent safety-critical task authority or acceptance decisions.",
  },
  diploma: {
    level: "diploma",
    rank: 2,
    purpose: "Applied technician reasoning, supervised calculations and maintenance context.",
    safetyBoundary: "Practical learning remains subject to controlled procedures, supervision and competence authorization.",
  },
  bachelors: {
    level: "bachelors",
    rank: 3,
    purpose: "Engineering analysis, modelling, design reasoning and technical justification.",
    safetyBoundary: "Academic engineering analysis does not replace applicable certification, approval or operational authority.",
  },
  "postgraduate-diploma": {
    level: "postgraduate-diploma",
    rank: 4,
    purpose: "Advanced applied engineering, asset, maintenance, safety and management integration.",
    safetyBoundary: "Advanced study must still distinguish educational analysis from controlled operational acceptance.",
  },
  masters: {
    level: "masters",
    rank: 5,
    purpose: "Advanced systems analysis, research, uncertainty evaluation, optimisation and integration.",
    safetyBoundary: "Research conclusions require applicable validation and governance before operational adoption.",
  },
};

export function getLevelProfile(level: QualificationLevel): LevelProfile {
  return profiles[level];
}

export function adaptKnowledgePack(
  pack: KnowledgePack,
  level: QualificationLevel,
): AdaptedKnowledgePack {
  return {
    ...pack,
    canonicalTerminology: pack.canonicalTerminology.map((term) => ({
      ...term,
      sourceIds: [...term.sourceIds],
    })),
    claims: pack.claims.map((claim) => ({
      ...claim,
      sourceIds: [...claim.sourceIds],
    })),
    equations: pack.equations.map((equation) => ({
      ...equation,
      variables: { ...equation.variables },
      sourceIds: [...equation.sourceIds],
    })),
    visualSpecs: pack.visualSpecs.map((visual) => ({
      ...visual,
      labels: [...visual.labels],
    })),
    prohibitedUnsupportedClaims: [...pack.prohibitedUnsupportedClaims],
    sourceIds: [...pack.sourceIds],
    levelGuidance: {
      certificate: { ...pack.levelGuidance.certificate },
      diploma: { ...pack.levelGuidance.diploma },
      bachelors: { ...pack.levelGuidance.bachelors },
      "postgraduate-diploma": { ...pack.levelGuidance["postgraduate-diploma"] },
      masters: { ...pack.levelGuidance.masters },
    },
    level,
    guidance: { ...pack.levelGuidance[level] },
    levelProfile: getLevelProfile(level),
  };
}
