import { defineConfig, devices } from "@playwright/test";

const E2E_AUTH_BYPASS_HEADER = "x-pak-e2e-auth-bypass";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /auth-boundary\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: {
          [E2E_AUTH_BYPASS_HEADER]: "allow",
        },
      },
    },
    {
      name: "chromium-unauthenticated",
      testMatch: /auth-boundary\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      E2E_AUTH_BYPASS: "true",
    },
  },
});
