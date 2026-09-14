import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DashboardWorkspace } from "@/modules/dashboard/service";
import { DashboardSummary } from "./dashboard-summary";

const projectId = "22222222-2222-4222-8222-222222222222";

const workspace: DashboardWorkspace = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationLabel: "Polish Railway Academy",
  role: "OWNER",
  identity: { profileRevision: 3, brandKitRevision: 2, activeCoreKnowledge: 2 },
  content: { total: 4, generated: 3, failed: 1 },
  knowledge: { total: 6, active: 5, draft: 1, coreActive: 2 },
  production: {
    projects: 2,
    plansNeedingWork: 1,
    approvedPlans: 1,
    generation: { active: 2, failed: 1, completed: 7 },
    assembly: { active: 0, failed: 1, completed: 1 },
    actionableProjectId: projectId,
  },
  media: { active: 12, video: 8, finalRenders: 1 },
  integrations: {
    openAI: { status: "CONFIGURED", lastVerifiedAt: "2026-09-10T14:50:35.810Z" },
    ltx: { status: "NOT_CONFIGURED" },
  },
  lastActivityAt: "2026-09-13T12:00:00.000Z",
  nextAction: {
    label: "Continue Scene Planning",
    href: `/scene-planning?project=${projectId}`,
    reason: "A current Scene Plan still needs planning, quality review, approval, or refresh work.",
  },
  openAI: { status: "CONFIGURED", lastVerifiedAt: "2026-09-10T14:50:35.810Z" },
};

describe("DashboardSummary", () => {
  it("renders the production command center from authoritative workspace data", () => {
    render(<DashboardSummary workspace={workspace} />);

    for (const heading of [
      "Institutional readiness",
      "Content production",
      "Trusted Knowledge",
      "Scene & video production",
      "Media Library",
      "Integrations",
      "Continue production",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    expect(screen.getByText("Polish Railway Academy")).toBeTruthy();
    expect(screen.getByText(/Profile revision 3/i)).toBeTruthy();
    expect(screen.getByText(/Brand Kit revision 2/i)).toBeTruthy();
    expect(screen.getByText(/2 ACTIVE Core Knowledge/i)).toBeTruthy();
    expect(screen.getByText(/OpenAI/i)).toBeTruthy();
    expect(screen.getByText(/LTX/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue Scene Planning" }).getAttribute("href")).toBe(`/scene-planning?project=${projectId}`);

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/health score/i);
    expect(body).not.toMatch(/approval count|publishing count|analytics count|podcast count/i);
  });

  it("renders truthful not-configured and zero states without inventing activity", () => {
    render(
      <DashboardSummary
        workspace={{
          ...workspace,
          identity: { profileRevision: null, brandKitRevision: null, activeCoreKnowledge: 0 },
          content: { total: 0, generated: 0, failed: 0 },
          knowledge: { total: 0, active: 0, draft: 0, coreActive: 0 },
          production: {
            projects: 0,
            plansNeedingWork: 0,
            approvedPlans: 0,
            generation: { active: 0, failed: 0, completed: 0 },
            assembly: { active: 0, failed: 0, completed: 0 },
          },
          media: { active: 0, video: 0, finalRenders: 0 },
          integrations: { openAI: { status: "NOT_CONFIGURED" }, ltx: { status: "NOT_CONFIGURED" } },
          nextAction: {
            label: "Complete institutional setup",
            href: "/settings",
            reason: "Organization Profile and Brand Kit must be configured before production context is complete.",
          },
          openAI: { status: "NOT_CONFIGURED" },
        }}
      />,
    );

    expect(screen.getAllByText("Not configured").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "Complete institutional setup" }).getAttribute("href")).toBe("/settings");
    expect(document.body.textContent).not.toContain("NaN");
  });

  it("renders a safe unavailable state without raw infrastructure details", () => {
    render(<DashboardSummary workspace={null} error="Workspace summary is temporarily unavailable." />);

    expect(screen.getByRole("alert").textContent).toContain("Workspace summary is temporarily unavailable.");
    expect(document.body.textContent).not.toContain("postgres://");
    expect(document.body.textContent).not.toContain("service_role");
  });
});
