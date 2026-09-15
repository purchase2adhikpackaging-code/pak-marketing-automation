export interface KnowledgeSelectionInput {
  title: string;
  orientation?: string;
  availablePackIds: readonly string[];
}

type SelectionRule = {
  packId: string;
  patterns: RegExp[];
  weight: number;
};

const RULES: SelectionRule[] = [
  {
    packId: "rolling-stock",
    patterns: [/rolling\s*stock/i, /vehicle/i, /wagon/i, /locomotive/i],
    weight: 8,
  },
  {
    packId: "mechanical-fundamentals",
    patterns: [
      /mathemat/i,
      /physics/i,
      /mechanic/i,
      /force/i,
      /motion/i,
      /dynamics?/i,
      /statics?/i,
    ],
    weight: 8,
  },
  {
    packId: "technical-drawing-documentation",
    patterns: [/drawing/i, /\bcad\b/i, /documentation/i, /technical\s+document/i],
    weight: 9,
  },
  {
    packId: "materials-metallurgy",
    patterns: [
      /materials?/i,
      /metallurg/i,
      /corrosion/i,
      /manufactur/i,
      /steel/i,
      /alloy/i,
    ],
    weight: 9,
  },
  {
    packId: "metrology-measurement",
    patterns: [/metrolog/i, /measurement/i, /measuring/i, /workshop/i, /tools?/i],
    weight: 9,
  },
  {
    packId: "safety-human-factors",
    patterns: [/safety/i, /occupational/i, /health\s*&?\s*safety/i, /human\s+factor/i],
    weight: 10,
  },
  {
    packId: "maintenance-ecm",
    patterns: [/maintenance/i, /\becm\b/i, /asset\s+care/i, /repair/i],
    weight: 8,
  },
  {
    packId: "quality-compliance",
    patterns: [/quality/i, /compliance/i, /audit/i, /assurance/i],
    weight: 7,
  },
  {
    packId: "braking-pneumatics",
    patterns: [/brak/i, /pneumatic/i, /air\s+brake/i],
    weight: 9,
  },
  {
    packId: "electrical-electronic",
    patterns: [/electrical/i, /electronic/i, /diagnostic/i, /circuit/i],
    weight: 8,
  },
  {
    packId: "bogies-suspension",
    patterns: [/bogie/i, /suspension/i],
    weight: 9,
  },
  {
    packId: "wheelsets-bearings",
    patterns: [/wheelset/i, /wheel\s*set/i, /bearing/i, /axle/i],
    weight: 9,
  },
  {
    packId: "welding-fabrication",
    patterns: [/weld/i, /fabricat/i],
    weight: 9,
  },
  {
    packId: "ndt-inspection",
    patterns: [/\bndt\b/i, /non[-\s]?destructive/i, /inspection/i],
    weight: 8,
  },
  {
    packId: "operations-logistics",
    patterns: [/operations?/i, /logistics?/i, /train\s+formation/i, /freight\s+flow/i],
    weight: 8,
  },
];

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function selectKnowledgePacksForSubject(
  input: KnowledgeSelectionInput,
): string[] {
  const available = new Set(input.availablePackIds);
  const haystack = normalize(`${input.title} ${input.orientation ?? ""}`);
  const scores = new Map<string, number>();

  if (available.has("railway-systems")) {
    scores.set("railway-systems", 1);
  }

  for (const rule of RULES) {
    if (!available.has(rule.packId)) continue;
    const matches = rule.patterns.reduce(
      (count, pattern) => count + (pattern.test(haystack) ? 1 : 0),
      0,
    );
    if (matches > 0) {
      scores.set(rule.packId, rule.weight + matches);
    }
  }

  const availableOrder = new Map(
    input.availablePackIds.map((packId, index) => [packId, index] as const),
  );

  return [...scores.entries()]
    .sort((left, right) => {
      const scoreDifference = right[1] - left[1];
      if (scoreDifference !== 0) return scoreDifference;
      return (availableOrder.get(left[0]) ?? 0) - (availableOrder.get(right[0]) ?? 0);
    })
    .map(([packId]) => packId);
}
