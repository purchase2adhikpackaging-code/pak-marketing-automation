import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSummary } from "./dashboard-summary";

const workspace = {
  organizationLabel: "Polish Railway Academy",
  role: "OWNER" as const,
  content: { total: 4, generated: 3, failed: 1 },
  knowledge: { total: 6, active: 5 },
  openAI: { status: "CONFIGURED" as const, lastVerifiedAt: "2026-09-10T14:50:35.810Z" },
};

describe("DashboardSummary", () => {
  it("shows only real implemented-domain operational data and workflow links", () => {
    render(<DashboardSummary workspace={workspace} />);

    expect(screen.getByText("Polish Railway Academy")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText(/Configured/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Content Studio/i }).getAttribute("href")).toBe("/content-studio");
    expect(screen.getByRole("link", { name: /Knowledge Base/i }).getAttribute("href")).toBe("/knowledge-base");
    expect(screen.getByRole("link", { name: /Settings/i }).getAttribute("href")).toBe("/settings");

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/approval count|publishing count|analytics count|podcast count/i);
  });

  it("renders an explanatory zero-data state without inventing activity", () => {
    render(
      <DashboardSummary
        workspace={{
          ...workspace,
          content: { total: 0, generated: 0, failed: 0 },
          knowledge: { total: 0, active: 0 },
          openAI: { status: "NOT_CONFIGURED" as const },
        }}
      />,
    );

    expect(screen.getByText(/No content has been generated yet/i)).toBeTruthy();
    expect(screen.getByText(/No Knowledge Base records are available yet/i)).toBeTruthy();
    expect(screen.getByText(/OpenAI is not configured/i)).toBeTruthy();
  });

  it("renders a safe unavailable state without raw infrastructure details", () => {
    render(<DashboardSummary workspace={null} error="Workspace summary is temporarily unavailable." />);

    expect(screen.getByRole("alert").textContent).toContain("Workspace summary is temporarily unavailable.");
    expect(document.body.textContent).not.toContain("postgres://");
    expect(document.body.textContent).not.toContain("service_role");
  });
});
