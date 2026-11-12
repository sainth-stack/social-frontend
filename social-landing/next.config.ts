import type { NextConfig } from "next";
import path from "node:path";

const sharedDir = path.resolve(__dirname, "../shared");

const config: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname, ".."),
    resolveAlias: {
      "@shared": sharedDir,
      "@shared/*": path.join(sharedDir, "*"),
    },
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@shared": sharedDir,
    };
    return webpackConfig;
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
};

export default config;