// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/publishing/production/actions", () => ({
  startProductionRun: vi.fn(),
  controlProductionRun: vi.fn(),
}));

import { PublishingProductionClient } from "@/app/(app)/publishing/production/production-client";

describe("PublishingProductionClient", () => {
  it("shows governed scope controls, four-worker default and Book Library navigation", () => {
    render(
      <PublishingProductionClient
        organizationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        programmes={[{ code: "PAK-D01", title: "Diploma in Railway Rolling Stock Engineering & Maintenance" }]}
        initialRuns={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: /Publishing Production Runner/i })).toBeTruthy();
    expect(screen.getByLabelText("Production scope")).toBeTruthy();
    expect(screen.getByLabelText("Programme")).toBeTruthy();
    expect(screen.getByLabelText("Concurrent workers")).toHaveValue(4);
    expect(screen.getByRole("link", { name: /Open Book Library/i })).toHaveAttribute("href", "/publishing/library");
  });

  it("shows blocked counters and run controls", () => {
    render(
      <PublishingProductionClient
        organizationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        programmes={[{ code: "PAK-D01", title: "Diploma" }]}
        initialRuns={[{
          id: "11111111-1111-4111-8111-111111111111",
          organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          createdBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          scopeType: "PILOT",
          scopeValue: {},
          status: "RUNNING",
          requestedConcurrency: 4,
          plannedCount: 3,
          queuedCount: 1,
          runningCount: 1,
          qaPassedCount: 0,
          blockedCount: 1,
          cancelledCount: 0,
          releasedCount: 0,
          idempotencyKey: null,
          createdAt: "2026-09-12T00:00:00Z",
          updatedAt: "2026-09-12T00:00:00Z",
          startedAt: "2026-09-12T00:00:00Z",
          completedAt: null,
        }]}
      />,
    );
    expect(screen.getByText("RUNNING")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
