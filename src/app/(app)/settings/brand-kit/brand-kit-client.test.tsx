import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";

vi.mock("./actions", () => ({
  saveBrandKitAction: vi.fn(),
}));

import { BrandKitClient } from "./brand-kit-client";

const brandKit: OrganizationBrandKit = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  primaryColor: "#0F2B46",
  secondaryColor: "#FFFFFF",
  accentColor: "#D51F2B",
  typographyRules: "Use a clean institutional sans-serif hierarchy.",
  brandVoice: "Professional, precise and European academic.",
  logoUsageRules: "Use the official logo without distortion.",
  visualConstraints: "Avoid novelty effects and unapproved marks.",
  primaryLogoAssetId: "22222222-2222-4222-8222-222222222222",
  approvedImageryAssetIds: [],
  revision: 2,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

const imageAssets = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "PAK Primary Logo",
    mimeType: "image/png",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "PAK Campus Exterior",
    mimeType: "image/jpeg",
  },
];

describe("BrandKitClient", () => {
  it("lets OWNER manage brand rules and select official Media Library image assets", () => {
    render(
      <BrandKitClient
        organizations={[{
          id: brandKit.organizationId,
          label: "PAK",
          role: "OWNER",
          brandKit,
          imageAssets: [...imageAssets],
        }]}
      />,
    );

    expect((screen.getByLabelText("Primary color") as HTMLInputElement).value).toBe("#0F2B46");
    const primaryLogo = screen.getByLabelText("Primary logo");
    expect((primaryLogo as HTMLSelectElement).value).toBe(imageAssets[0]!.id);
    expect(within(primaryLogo).getByRole("option", { name: "PAK Primary Logo" })).not.toBeNull();
    expect(within(primaryLogo).getByRole("option", { name: "PAK Campus Exterior" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save Brand Kit" })).not.toBeNull();
    expect(document.body.textContent).not.toContain("storage/");
  });

  it("renders Brand Kit read-only for non-managers", () => {
    render(
      <BrandKitClient
        organizations={[{
          id: brandKit.organizationId,
          label: "PAK",
          role: "REVIEWER",
          brandKit,
          imageAssets: [...imageAssets],
        }]}
      />,
    );

    expect((screen.getByLabelText("Primary color") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Primary logo") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save Brand Kit" })).toBeNull();
    expect(screen.getByText(/Owner or Admin access is required to edit/i)).not.toBeNull();
  });
});