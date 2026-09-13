import type { AppRole } from "./roles";
import { canBypassAuthForE2E } from "./e2e-bypass";

export const E2E_FIXTURE_HEADER = "x-pak-e2e-fixture";

// Keep fixture authorization checks on the same role vocabulary as production.
// The header resolver below intentionally exposes only OWNER and REVIEWER fixtures.
export type E2EFixtureRole = AppRole;

export function resolveE2EFixtureRole(input: {
  nodeEnv: string | undefined;
  bypassEnabled: string | undefined;
  bypassHeaderValue: string | null;
  fixtureHeaderValue: string | null;
}): E2EFixtureRole | null {
  if (!canBypassAuthForE2E({
    nodeEnv: input.nodeEnv,
    bypassEnabled: input.bypassEnabled,
    headerValue: input.bypassHeaderValue,
  })) {
    return null;
  }

  if (input.fixtureHeaderValue === "owner") return "OWNER";
  if (input.fixtureHeaderValue === "reviewer") return "REVIEWER";
  return null;
}
