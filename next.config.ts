import type { NextConfig } from "next";

const chromiumAssets = ["./node_modules/@sparticuz/chromium/**/*"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/internal/publishing-worker": [
      "./publishing/**/*",
      ...chromiumAssets,
    ],
    "/api/internal/publishing-browser-health": chromiumAssets,
    "/api/internal/publishing-d01-qa-preflight": chromiumAssets,
  },
};

export default nextConfig;
