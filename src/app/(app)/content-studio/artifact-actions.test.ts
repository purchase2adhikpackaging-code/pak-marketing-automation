import { describe, expect, it } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type {
  GenerateTranslationRequest,
  RegenerateSourceRequest,
  ScriptArtifact,
} from "@/modules/content-studio/artifacts/types";
import {
  executeGenerateTranslationAction,
  executeRegenerateSourceAction,
  type ScriptArtifactActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const contentItemId = "22222222-2222-4222-8222-222222222222";

function artifact(): ScriptArtifact {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId,
    contentItemId,
    language: "PL",
    isSource: false,
    status: "GENERATED",
    scriptText: "Translated PAK script.",
    revision: 2,
    sourceRevision: 1,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  };
}

function sourceArtifact(): ScriptArtifact {
  const { sourceRevision: _sourceRevision, ...base } = artifact();
  return { ...base, language: "EN", isSource: true };
}

function dependencies(options: {
  authenticated?: boolean;
  role?: AppRole | null;
  fail?: boolean;
} = {}): ScriptArtifactActionDependencies {
  const authenticated = options.authenticated ?? true;
  const role = options.role === undefined ? "EDITOR" : options.role;

  return {
    async getActor() {
      return authenticated ? { id: "actor-user" } : null;
    },
    async getMembership() {
      return role ? { role } : null;
    },
    async generateTranslation(request: GenerateTranslationRequest, actorUserId: string) {
      if (options.fail) throw new Error("provider raw secret sk-do-not-leak");
      expect(actorUserId).toBe("actor-user");
      expect(request).toEqual({ organizationId, contentItemId, targetLanguage: "PL" });
      return artifact();
    },
    async regenerateSource(request: RegenerateSourceRequest, actorUserId: string) {
      if (options.fail) throw new Error("persistence raw secret sk-do-not-leak");
      expect(actorUserId).toBe("actor-user");
      expect(request).toEqual({ organizationId, contentItemId });
      return sourceArtifact();
    },
  };
}

describe("multilingual artifact actions", () => {
  it("rejects invalid translation input without invoking workflow", async () => {
    let invoked = false;
    const deps = dependencies();
    deps.generateTranslation = async () => {
      invoked = true;
      return artifact();
    };

    const result = await executeGenerateTranslationAction({ organizationId: "bad", contentItemId, targetLanguage: "PL" }, deps);

    expect(result).toEqual({ ok: false, error: "Please check the translation details and try again." });
    expect(invoked).toBe(false);
  });

  it("rejects unauthenticated actors", async () => {
    const result = await executeGenerateTranslationAction(
      { organizationId, contentItemId, targetLanguage: "PL" },
      dependencies({ authenticated: false }),
    );

    expect(result).toEqual({ ok: false, error: "You must be signed in to manage content artifacts." });
  });

  it("rejects missing membership and read-only roles", async () => {
    for (const role of [null, "REVIEWER", "ANALYST"] as const) {
      const result = await executeRegenerateSourceAction(
        { organizationId, contentItemId },
        dependencies({ role }),
      );

      expect(result).toEqual({ ok: false, error: "You do not have permission to manage content artifacts for this organization." });
    }
  });

  it.each(["OWNER", "ADMIN", "EDITOR"] as const)("allows %s to generate a translation", async (role) => {
    const result = await executeGenerateTranslationAction(
      { organizationId, contentItemId, targetLanguage: "PL" },
      dependencies({ role }),
    );

    expect(result).toEqual({ ok: true, artifact: artifact() });
  });

  it("allows an editor to regenerate the canonical source", async () => {
    const result = await executeRegenerateSourceAction(
      { organizationId, contentItemId },
      dependencies({ role: "EDITOR" }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact.isSource).toBe(true);
      expect(result.artifact.language).toBe("EN");
    }
  });

  it("normalizes workflow exceptions without leaking provider details", async () => {
    const result = await executeGenerateTranslationAction(
      { organizationId, contentItemId, targetLanguage: "PL" },
      dependencies({ fail: true }),
    );

    expect(result).toEqual({ ok: false, error: "Content artifact generation is temporarily unavailable." });
    expect(JSON.stringify(result)).not.toContain("sk-do-not-leak");
  });
});
