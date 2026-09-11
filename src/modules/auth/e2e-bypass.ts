export const E2E_AUTH_BYPASS_HEADER = "x-pak-e2e-auth-bypass";

export function canBypassAuthForE2E(input: {
  nodeEnv: string | undefined;
  bypassEnabled: string | undefined;
  headerValue: string | null;
}): boolean {
  return input.nodeEnv !== "production" && input.bypassEnabled === "true" && input.headerValue === "allow";
}
