import type { NextConfig } from "next";

const chromiumAssets = ["./node_modules/@sparticuz/chromium/**/*"];
const pdfJsAssets = ["./node_modules/pdfjs-dist/legacy/build/**/*"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/internal/publishing-worker": [
      "./publishing/**/*",
      ...chromiumAssets,
      ...pdfJsAssets,
    ],
    "/api/internal/publishing-browser-health": chromiumAssets,
    "/api/internal/publishing-d01-qa-preflight": [
      ...chromiumAssets,
      ...pdfJsAssets,
    ],
  },
};

export default nextConfig;
