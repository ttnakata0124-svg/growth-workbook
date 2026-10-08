import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // 教材写真のアップロード（スマホ写真）に対応
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
