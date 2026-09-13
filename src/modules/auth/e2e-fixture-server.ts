import "server-only";

import { headers } from "next/headers";
import { E2E_AUTH_BYPASS_HEADER } from "./e2e-bypass";
import { E2E_FIXTURE_HEADER, resolveE2EFixtureRole, type E2EFixtureRole } from "./e2e-fixture";

export async function getE2EFixtureRole(): Promise<E2EFixtureRole | null> {
  const requestHeaders = await headers();
  return resolveE2EFixtureRole({
    nodeEnv: process.env.NODE_ENV,
    bypassEnabled: process.env.E2E_AUTH_BYPASS,
    bypassHeaderValue: requestHeaders.get(E2E_AUTH_BYPASS_HEADER),
    fixtureHeaderValue: requestHeaders.get(E2E_FIXTURE_HEADER),
  });
}
