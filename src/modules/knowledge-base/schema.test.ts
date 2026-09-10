import { describe, expect, it } from "vitest";

import { createKnowledgeRecordSchema, updateKnowledgeRecordSchema } from "./schema";

const validCreate = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  title: "Workshop safety standard",
  content: "Approved PAK workshop safety information.",
  sourceType: "MANUAL" as const,
};

describe("Knowledge Base schemas", () => {
  it.each(["MANUAL", "DOCUMENT", "URL"] as const)("accepts source type %s", (sourceType) => {
    expect(createKnowledgeRecordSchema.parse({ ...validCreate, sourceType }).sourceType).toBe(sourceType);
  });

  it("rejects unsupported source types", () => {
    expect(() => createKnowledgeRecordSchema.parse({ ...validCreate, sourceType: "API" })).toThrow();
  });

  it.each(["DRAFT", "ACTIVE", "ARCHIVED"] as const)("accepts lifecycle status %s", (status) => {
    const parsed = updateKnowledgeRecordSchema.parse({
      ...validCreate,
      id: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      status,
    });

    expect(parsed.status).toBe(status);
  });

  it("rejects unsupported lifecycle status", () => {
    expect(() =>
      updateKnowledgeRecordSchema.parse({
        ...validCreate,
        id: "22222222-2222-4222-8222-222222222222",
        expectedRevision: 1,
        status: "DELETED",
      }),
    ).toThrow();
  });

  it("rejects invalid organization and record identifiers", () => {
    expect(() => createKnowledgeRecordSchema.parse({ ...validCreate, organizationId: "not-a-uuid" })).toThrow();
    expect(() =>
      updateKnowledgeRecordSchema.parse({
        ...validCreate,
        id: "not-a-uuid",
        expectedRevision: 1,
        status: "DRAFT",
      }),
    ).toThrow();
  });

  it("rejects non-positive expected revisions", () => {
    expect(() =>
      updateKnowledgeRecordSchema.parse({
        ...validCreate,
        id: "22222222-2222-4222-8222-222222222222",
        expectedRevision: 0,
        status: "ACTIVE",
      }),
    ).toThrow();
  });
});
