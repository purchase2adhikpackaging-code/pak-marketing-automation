import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/internal/publishing-worker": [
      "./publishing/**/*",
      "./node_modules/@sparticuz/chromium/**/*",
    ],
    "/api/internal/publishing-browser-health": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },
};

export default nextConfig;
