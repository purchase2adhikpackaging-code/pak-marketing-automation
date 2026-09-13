import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  saveOrganizationProfileAction: vi.fn(),
}));

import { OrganizationProfileClient } from "./profile-client";

const profile = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  officialName: "Polish Railway Academy",
  shortName: "PAK",
  about: "Railway education and professional training.",
  address: "Warsaw, Poland",
  primaryEmail: "office@example.org",
  primaryPhone: "+48 000 000 000",
  website: "https://example.org",
  socialLinks: { linkedin: "https://linkedin.com/company/example" },
  defaultLanguage: "en",
  timezone: "Europe/Warsaw",
  legalIdentifiers: { registry: "PAK-001" },
  revision: 3,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
} as const;

describe("OrganizationProfileClient", () => {
  it("lets OWNER edit the authoritative organization profile", () => {
    render(
      <OrganizationProfileClient
        organizations={[{
          id: profile.organizationId,
          label: "PAK",
          role: "OWNER",
          profile,
        }]}
      />,
    );

    expect((screen.getByLabelText("Official name") as HTMLInputElement).value).toBe("Polish Railway Academy");
    expect(screen.getByRole("button", { name: "Save Organization Profile" })).not.toBeNull();
    expect((screen.getByLabelText("Official name") as HTMLInputElement).disabled).toBe(false);
  });

  it("renders the profile read-only for non-managers", () => {
    render(
      <OrganizationProfileClient
        organizations={[{
          id: profile.organizationId,
          label: "PAK",
          role: "EDITOR",
          profile,
        }]}
      />,
    );

    expect((screen.getByLabelText("Official name") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save Organization Profile" })).toBeNull();
    expect(screen.getByText(/Owner or Admin access is required to edit/i)).not.toBeNull();
  });
});