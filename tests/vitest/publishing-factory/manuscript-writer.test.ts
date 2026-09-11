import { describe, expect, it } from "vitest";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type {
  TextGenerationRequest,
  TextGenerationResult,
} from "@/modules/ai/text/types";
import type { BookBlueprint } from "@/modules/publishing-factory/blueprint";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { ManuscriptKnowledgeContext } from "@/modules/publishing-factory/knowledge-context";
import {
  generateBookBlueprint,
  generateChapterManuscript,
} from "@/modules/publishing-factory/manuscript-writer";

class QueueProvider implements TextGenerationProvider {
  readonly name = "fixture";
  readonly requests: TextGenerationRequest[] = [];
  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  async validateConfiguration(): Promise<void> {}

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    this.requests.push(request);
    const text = this.responses.shift();
    if (text === undefined) throw new Error("No fixture response available.");
    return { text, provider: this.name, model: "fixture-model" };
  }
}

const job: BookJob = {
  bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-102",
  subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "PLANNED",
  repairAttempts: {},
};

const context: ManuscriptKnowledgeContext = {
  level: "diploma",
  levelProfile: {
    level: "diploma",
    rank: 2,
    purpose: "Applied technician reasoning.",
    safetyBoundary: "Training does not confer safety-critical authorization.",
  },
  selectedPacks: [
    {
      packId: "mechanical-fundamentals",
      domain: "mechanical-fundamentals",
      title: "Mechanical Fundamentals",
      revision: "1.0.0",
      sha256: "b".repeat(64),
      guidance: {
        depth: "Applied technician depth.",
        maths: "Use supervised engineering calculations.",
        practical: "Connect calculations to workshop observations.",
        assessment: "Use applied problems.",
      },
    },
  ],
  canonicalTerminology: [],
  claimsByDomain: {},
  equations: [],
  visualSpecs: [],
  sourceRegister: [
    {
      id: "eu-2016-797",
      title: "Directive (EU) 2016/797",
      publisher: "European Union",
      authority: "eu-law",
      url: "https://eur-lex.europa.eu/eli/dir/2016/797/oj",
      accessedDate: "2026-09-11",
      scopeNote: "Interoperability framework.",
    },
  ],
  prohibitedUnsupportedClaims: ["Do not invent wheel or brake acceptance limits."],
  safetyControls: {
    levelBoundary: "Training does not confer safety-critical authorization.",
    rules: ["Do not introduce unsupported safety-critical numeric limits."],
    safetyCriticalClaimIds: [],
  },
};

const blueprint: BookBlueprint = {
  bookId: job.bookId,
  programmeCode: job.programmeCode,
  subjectCode: job.subjectCode,
  subjectTitle: job.subjectTitle,
  level: job.level,
  purpose: "Build applied railway engineering calculation competence.",
  prerequisites: [],
  knowledgePackIds: ["mechanical-fundamentals"],
  chapters: [
    {
      id: "D01-102-CH01",
      number: 1,
      title: "Engineering quantities and units",
      purpose: "Establish controlled calculation conventions.",
      learningOutcomes: ["Apply units consistently in railway calculations."],
      requiredKnowledgePackIds: ["mechanical-fundamentals"],
      requiredVisualIds: [],
      workedExampleRequirements: ["Unit conversion exercise"],
      practicalRequirements: [],
      assessmentRequirements: ["Short calculation set"],
      safetyCritical: false,
      referenceSourceIds: [],
    },
  ],
};

const blueprintJson = JSON.stringify(blueprint);
const chapterJson = JSON.stringify({
  chapterId: "D01-102-CH01",
  number: 1,
  title: "Engineering quantities and units",
  purpose: "Establish controlled calculation conventions.",
  learningOutcomes: ["Apply units consistently in railway calculations."],
  keyTerms: [
    {
      term: "SI unit",
      explanation: "A defined engineering unit used consistently in technical calculations.",
    },
  ],
  sections: [
    {
      heading: "Engineering quantities",
      paragraphs: [
        "Railway engineering calculations require explicit quantities and consistent units so that each step can be independently checked and reproduced.",
      ],
    },
  ],
  workedExamples: [
    {
      title: "Unit conversion",
      problem: "Convert a railway speed value into the unit needed by a downstream engineering equation.",
      solutionSteps: ["State the source unit.", "Apply conversion factors.", "Check the final unit."],
      conclusion: "The converted value is ready for the intended equation.",
    },
  ],
  practicalActivities: [],
  safetyNotes: [
    "Training calculations do not replace controlled limits for a real railway asset.",
  ],
  knowledgeChecks: ["Why must engineering units remain explicit?"],
  summary: ["Use consistent engineering units and show conversion steps."],
  reviewQuestions: ["Explain how to verify a unit conversion."],
  sourceIds: ["eu-2016-797"],
});

describe("governed manuscript writer", () => {
  it("grounds blueprint generation in exact identity, level and allowed knowledge", async () => {
    const provider = new QueueProvider([blueprintJson]);
    const result = await generateBookBlueprint({
      provider,
      job,
      curriculumText: "D01-102 | Applied Engineering Mathematics & Physics for Railways",
      knowledgeContext: context,
    });

    expect(result.bookId).toBe(job.bookId);
    const request = provider.requests[0]!;
    const grounding = `${request.systemInstructions}\n${request.knowledgeContext ?? ""}`;
    expect(grounding).toContain(job.bookId);
    expect(grounding).toContain(job.subjectCode);
    expect(grounding).toContain("diploma");
    expect(grounding).toContain("eu-2016-797");
    expect(grounding).toContain("Do not invent wheel or brake acceptance limits.");
    expect(grounding).toContain("Training does not confer safety-critical authorization.");
  });

  it("rejects malformed non-JSON provider output", async () => {
    const provider = new QueueProvider(["Here is the chapter you requested..."]);
    await expect(
      generateBookBlueprint({
        provider,
        job,
        curriculumText: "D01-102 curriculum",
        knowledgeContext: context,
      }),
    ).rejects.toThrow(/json/i);
  });

  it("generates a chapter only when it validates against blueprint and provenance", async () => {
    const provider = new QueueProvider([chapterJson]);
    const result = await generateChapterManuscript({
      provider,
      job,
      blueprint,
      chapterBlueprint: blueprint.chapters[0]!,
      knowledgeContext: context,
    });
    expect(result.chapterId).toBe("D01-102-CH01");
  });

  it("rejects a provider chapter that cites an unknown source", async () => {
    const ungrounded = JSON.stringify({
      ...JSON.parse(chapterJson),
      sourceIds: ["invented-source"],
    });
    const provider = new QueueProvider([ungrounded]);
    await expect(
      generateChapterManuscript({
        provider,
        job,
        blueprint,
        chapterBlueprint: blueprint.chapters[0]!,
        knowledgeContext: context,
      }),
    ).rejects.toThrow(/grounding context|source/i);
  });
});
