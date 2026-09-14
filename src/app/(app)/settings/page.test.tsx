import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  profileGet: vi.fn(),
  brandGet: vi.fn(),
  listConnections: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/modules/organization-profile/repository", () => ({
  organizationProfileRepository: { get: mocks.profileGet },
}));

vi.mock("@/modules/brand-kit/repository", () => ({
  brandKitRepository: { get: mocks.brandGet },
}));

vi.mock("@/modules/integrations/repository", () => ({
  SupabaseIntegrationMetadataStore: class {
    listConnections = mocks.listConnections;
  },
}));

vi.mock("./integrations/integrations-manager", () => ({
  IntegrationsManager: ({ organizations }: { organizations: Array<{ id: string }> }) => (
    <div data-testid="integrations-manager">Live integrations for {organizations.length} organizations</div>
  ),
}));

import SettingsPage from "./page";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

function connection(organizationId: string, provider: "OPENAI" | "LTX" | "META", status: "CONFIGURED" | "INVALID" | "DISABLED") {
  return {
    id: `${organizationId.slice(0, 8)}-${provider.toLowerCase()}`,
    organizationId,
    provider,
    status,
    config: {},
    secretVersion: 1,
    maskedHint: "••••safe",
    createdBy: "must-not-render-created-by",
    updatedBy: "must-not-render-updated-by",
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.createServerSupabaseClient.mockReset();
    mocks.profileGet.mockReset();
    mocks.brandGet.mockReset();
    mocks.listConnections.mockReset();

    const memberships = [
      { organization_id: ORG_A, role: "OWNER", organizations: { name: "PAK Poland" } },
      { organization_id: ORG_B, role: "ADMIN", organizations: { name: "PAK Training" } },
    ];
    const eq = vi.fn().mockResolvedValue({ data: memberships, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    });

    mocks.profileGet.mockImplementation(async (organizationId: string) => {
      if (organizationId === ORG_A) {
        return {
          organizationId,
          officialName: "Polish Railway Academy",
          socialLinks: {},
          defaultLanguage: "en",
          timezone: "Europe/Warsaw",
          legalIdentifiers: {},
          revision: 3,
          createdAt: "2026-09-14T00:00:00.000Z",
          updatedAt: "2026-09-14T00:00:00.000Z",
        };
      }
      throw new AppError("NOT_FOUND", "Organization Profile is not configured.");
    });

    mocks.brandGet.mockImplementation(async (organizationId: string) => {
      if (organizationId === ORG_B) {
        return {
          organizationId,
          approvedImageryAssetIds: [],
          revision: 2,
          createdAt: "2026-09-14T00:00:00.000Z",
          updatedAt: "2026-09-14T00:00:00.000Z",
        };
      }
      throw new AppError("NOT_FOUND", "Brand Kit is not configured.");
    });

    mocks.listConnections.mockImplementation(async (organizationId: string) => {
      if (organizationId === ORG_A) {
        return [
          connection(organizationId, "OPENAI", "CONFIGURED"),
          connection(organizationId, "LTX", "INVALID"),
          connection(organizationId, "META", "CONFIGURED"),
        ];
      }
      return [];
    });
  });

  it("summarizes Profile, Brand Kit and provider readiness per organization without exposing secret values", async () => {
    render(await SettingsPage());

    const pakPoland = screen.getByRole("region", { name: "PAK Poland settings summary" });
    expect(within(pakPoland).getByText("Organization Profile")).toBeTruthy();
    expect(within(pakPoland).getByText("Configured · Revision 3")).toBeTruthy();
    expect(within(pakPoland).getByText("Brand Kit")).toBeTruthy();
    expect(within(pakPoland).getByText("Not configured")).toBeTruthy();
    expect(within(pakPoland).getByText("OpenAI")).toBeTruthy();
    expect(within(pakPoland).getByText("CONFIGURED")).toBeTruthy();
    expect(within(pakPoland).getByText("LTX")).toBeTruthy();
    expect(within(pakPoland).getByText("INVALID")).toBeTruthy();
    expect(within(pakPoland).getByText("Meta")).toBeTruthy();
    expect(within(pakPoland).getByText("Planned · Phase 10")).toBeTruthy();

    const pakTraining = screen.getByRole("region", { name: "PAK Training settings summary" });
    expect(within(pakTraining).getAllByText("Not configured")).toHaveLength(3);
    expect(within(pakTraining).getByText("Configured · Revision 2")).toBeTruthy();

    expect(screen.getByRole("link", { name: /Organization Profile/i })).toHaveAttribute("href", "/settings/organization-profile");
    expect(screen.getByRole("link", { name: /Brand Kit/i })).toHaveAttribute("href", "/settings/brand-kit");
    expect(screen.getByTestId("integrations-manager").textContent).toContain("2 organizations");
    expect(document.body.textContent).not.toContain("must-not-render-created-by");
    expect(document.body.textContent).not.toContain("must-not-render-updated-by");
  });

  it("rethrows non-NOT_FOUND identity repository failures instead of hiding them as unconfigured", async () => {
    mocks.profileGet.mockRejectedValueOnce(new AppError("INTERNAL_ERROR", "Unable to load Organization Profile."));

    await expect(SettingsPage()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Unable to load Organization Profile.",
    });
  });
});
