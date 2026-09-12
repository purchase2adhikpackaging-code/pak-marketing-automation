import { describe, expect, it } from "vitest";

import { normalizeMediaListQuery } from "./read-model";

describe("media catalogue read model", () => {
  it("defaults to active media and a bounded page size", () => {
    expect(normalizeMediaListQuery({ organizationId: "11111111-1111-4111-8111-111111111111" })).toEqual({
      organizationId: "11111111-1111-4111-8111-111111111111",
      status: "ACTIVE",
      limit: 24,
    });
  });

  it("caps page size at 50 and preserves deterministic cursor", () => {
    expect(normalizeMediaListQuery({
      organizationId: "11111111-1111-4111-8111-111111111111",
      limit: 500,
      cursor: { createdAt: "2026-09-12T00:00:00.000Z", id: "22222222-2222-4222-8222-222222222222" },
    })).toMatchObject({
      limit: 50,
      cursor: { createdAt: "2026-09-12T00:00:00.000Z", id: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("normalizes search and filters without accepting an empty search", () => {
    expect(normalizeMediaListQuery({
      organizationId: "11111111-1111-4111-8111-111111111111",
      assetType: "VIDEO",
      source: "GENERATED",
      status: "ARCHIVED",
      search: "  final video  ",
    })).toMatchObject({
      assetType: "VIDEO",
      source: "GENERATED",
      status: "ARCHIVED",
      search: "final video",
    });

    expect(normalizeMediaListQuery({
      organizationId: "11111111-1111-4111-8111-111111111111",
      search: "   ",
    })).not.toHaveProperty("search");
  });
});
