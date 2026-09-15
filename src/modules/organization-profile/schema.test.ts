import { describe, expect, it } from "vitest";

import { organizationProfileUpdateSchema } from "./schema";

describe("organizationProfileUpdateSchema", () => {
  const valid = {
    officialName: "Polish Railway Academy",
    shortName: "PAK",
    about: "Professional railway education and training institution.",
    address: "Warsaw, Poland",
    primaryEmail: "info@example.com",
    primaryPhone: "+48 123 456 789",
    website: "https://example.com",
    socialLinks: {
      linkedin: "https://www.linkedin.com/company/example",
      youtube: "https://www.youtube.com/@example",
    },
    defaultLanguage: "en",
    timezone: "Europe/Warsaw",
    legalIdentifiers: { registrationNumber: "PAK-001" },
    expectedRevision: 1,
  };

  it("accepts bounded institution identity fields", () => {
    expect(organizationProfileUpdateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects malformed URLs, oversized text and invalid revisions", () => {
    expect(() => organizationProfileUpdateSchema.parse({ ...valid, website: "not-a-url" })).toThrow();
    expect(() => organizationProfileUpdateSchema.parse({ ...valid, about: "x".repeat(12001) })).toThrow();
    expect(() => organizationProfileUpdateSchema.parse({ ...valid, expectedRevision: 0 })).toThrow();
  });

  it("rejects unexpected trusted/system fields", () => {
    expect(() => organizationProfileUpdateSchema.parse({ ...valid, organizationId: crypto.randomUUID() })).toThrow();
    expect(() => organizationProfileUpdateSchema.parse({ ...valid, revision: 99 })).toThrow();
  });
});
