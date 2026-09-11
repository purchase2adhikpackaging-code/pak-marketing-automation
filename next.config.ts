import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/internal/publishing-worker": [
      "./publishing/**/*",
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },
};

export default nextConfig;
