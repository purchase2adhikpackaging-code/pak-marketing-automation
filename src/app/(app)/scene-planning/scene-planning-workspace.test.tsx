import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenePlanningWorkspace, type ScenePlanningWorkspaceProps } from "./scene-planning-workspace";
import {
  approveScenePlanAction,
  cloneScenePlanForEditAction,
  generateScenePlanAction,
  runScenePlanQcAction,
  saveScenePlanningBriefAction,
  saveVisualBibleAction,
  submitScenePlanForReviewAction,
} from "./workflow-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./workflow-actions", () => ({
  approveScenePlanAction: vi.fn(),
  cloneScenePlanForEditAction: vi.fn(),
  generateScenePlanAction: vi.fn(),
  runScenePlanQcAction: vi.fn(),
  saveScenePlanningBriefAction: vi.fn(),
  saveVisualBibleAction: vi.fn(),
  submitScenePlanForReviewAction: vi.fn(),
}));
vi.mock("./draft-edit-actions", () => ({
  reorderScenePlanScenesAction: vi.fn(),
  reorderScenePlanShotsAction: vi.fn(),
  updateScenePlanSceneDraftAction: vi.fn(),
  updateScenePlanShotDraftAction: vi.fn(),
}));
vi.mock("./granular-replan-actions", () => ({ granularReplanScenePlanAction: vi.fn() }));

function props(overrides: Partial<ScenePlanningWorkspaceProps> = {}): ScenePlanningWorkspaceProps {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    actorRole: "OWNER",
    project: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "PAK Credibility Film",
      purpose: "International institutional credibility",
      targetDurationSeconds: 55,
      aspectRatio: "16:9",
      qualityProfile: "CINEMATIC",
      targetPlatforms: ["youtube", "linkedin"],
      language: "EN",
      sourceIntegrityHash: "sha256:current",
    },
    visualBible: {
      characters: ["Railway trainer, navy technical uniform"],
      locations: ["Modern railway systems laboratory"],
      globalNegativeConstraints: ["no plastic faces"],
      realismLevel: "photorealistic institutional documentary-cinematic",
      cinematographyLanguage: "restrained camera movement",
      lightingLanguage: "natural daylight and soft industrial practicals",
    },
    plan: {
      id: "33333333-3333-4333-8333-333333333333",
      versionNumber: 2,
      status: "REVIEW_REQUIRED",
      sourceFresh: true,
      qcSummary: { blockerCount: 0, warningCount: 1, infoCount: 0 },
      findings: [{ id: "finding-1", severity: "WARNING", code: "TARGET_DURATION_MISMATCH", message: "Review pacing before approval.", acknowledged: false }],
      scenes: [{
        id: "scene-1",
        ordinal: 1,
        title: "Technical credibility",
        narrativeRole: "HOOK",
        durationSeconds: 6,
        creativeDirection: "Establish technical seriousness.",
        shots: [{
          id: "shot-1",
          ordinal: 1,
          durationSeconds: 6,
          narrationText: "Railway excellence begins here.",
          narrationStartChar: 0,
          narrationEndChar: 31,
          creativeDirection: "Trainer enters the railway systems laboratory.",
          masterVisualPrompt: "Photorealistic European railway training laboratory with a trainer entering frame.",
          cameraMotion: "slow dolly in",
          humanModified: false,
        }],
      }],
    },
    ...overrides,
  };
}

describe("ScenePlanningWorkspace", () => {
  beforeEach(() => {
    refresh.mockReset();
    for (const fn of [approveScenePlanAction, cloneScenePlanForEditAction, generateScenePlanAction, runScenePlanQcAction, saveScenePlanningBriefAction, saveVisualBibleAction, submitScenePlanForReviewAction]) vi.mocked(fn).mockReset();
  });

  it("renders production brief, Visual Bible, scene timeline, and separate creative/generation specifications", () => {
    render(<ScenePlanningWorkspace {...props()} />);
    expect(screen.getByRole("heading", { name: "Production Brief" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Visual Bible" })).toBeTruthy();
    expect(screen.getByText("Scene 1 · HOOK")).toBeTruthy();
    expect(screen.getByLabelText("Shot 1.1 creative direction")).toBeTruthy();
    expect(screen.getByLabelText("Shot 1.1 generation specification")).toBeTruthy();
    expect(screen.getByText(/Characters 0–31/)).toBeTruthy();
    expect(screen.getByText("Railway excellence begins here.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Scene 1 changes" })).toBeTruthy();
  });

  it("saves the brief and Visual Bible through server actions", async () => {
    vi.mocked(saveScenePlanningBriefAction).mockResolvedValue({ ok: true });
    vi.mocked(saveVisualBibleAction).mockResolvedValue({ ok: true });
    render(<ScenePlanningWorkspace {...props()} />);
    fireEvent.change(screen.getByLabelText("Project title"), { target: { value: "Updated PAK Film" } });
    fireEvent.click(screen.getByRole("button", { name: "Save production brief" }));
    await waitFor(() => expect(saveScenePlanningBriefAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated PAK Film", targetDurationSeconds: 55 })));
    fireEvent.change(screen.getByLabelText("Characters"), { target: { value: "Trainer\nTrainee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Visual Bible" }));
    await waitFor(() => expect(saveVisualBibleAction).toHaveBeenCalledWith(expect.objectContaining({ characters: ["Trainer", "Trainee"] })));
  });

  it("generates and reruns QC through server actions then refreshes", async () => {
    vi.mocked(generateScenePlanAction).mockResolvedValue({ ok: true, planVersionId: "plan-3", blockerCount: 0, warningCount: 0 });
    vi.mocked(runScenePlanQcAction).mockResolvedValue({ ok: true, blockerCount: 0, warningCount: 0 });
    render(<ScenePlanningWorkspace {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Scene Plan" }));
    await waitFor(() => expect(generateScenePlanAction).toHaveBeenCalledWith({ organizationId: props().organizationId, projectId: props().project.id }));
    await screen.findByText("Scene Plan generated with 0 blockers and 0 warnings.");
    const runQc = screen.getByRole("button", { name: "Run QC" }) as HTMLButtonElement;
    await waitFor(() => expect(runQc.disabled).toBe(false));
    fireEvent.click(runQc);
    await waitFor(() => expect(runScenePlanQcAction).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it("requires explicit warning acknowledgement for approval", async () => {
    vi.mocked(approveScenePlanAction).mockResolvedValue({ ok: true });
    render(<ScenePlanningWorkspace {...props()} />);
    const approve = screen.getByRole("button", { name: "Approve Scene Plan" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge outstanding QC warnings" }));
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    await waitFor(() => expect(approveScenePlanAction).toHaveBeenCalledWith(expect.objectContaining({ acknowledgeWarnings: true })));
  });

  it("blocks approval when source is stale or blockers exist", () => {
    const stale = props({ plan: { ...props().plan!, sourceFresh: false } });
    const { rerender } = render(<ScenePlanningWorkspace {...stale} />);
    expect((screen.getByRole("button", { name: "Approve Scene Plan" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<ScenePlanningWorkspace {...props({ plan: { ...props().plan!, qcSummary: { blockerCount: 1, warningCount: 0, infoCount: 0 } } })} />);
    expect((screen.getByRole("button", { name: "Approve Scene Plan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps approved versions read-only and offers copy-on-write editing", async () => {
    vi.mocked(cloneScenePlanForEditAction).mockResolvedValue({ ok: true, planVersionId: "plan-3" });
    render(<ScenePlanningWorkspace {...props({ plan: { ...props().plan!, status: "APPROVED" } })} />);
    expect(screen.getByText("Approved versions are immutable.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run QC" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Scene 1 changes" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create editable version" }));
    await waitFor(() => expect(cloneScenePlanForEditAction).toHaveBeenCalled());
  });

  it("requires QC rerun before an EDITOR can progress a modified plan", () => {
    render(<ScenePlanningWorkspace {...props({
      actorRole: "EDITOR",
      plan: { ...props().plan!, status: "QC_REQUIRED" },
    })} />);
    expect(screen.queryByRole("button", { name: "Approve Scene Plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
    expect(screen.getByRole("button", { name: "Run QC" })).toBeTruthy();
  });
});
