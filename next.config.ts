import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  images: {
    unoptimized: true,
  },
  outputFileTracingExcludes: {
    "**/*": [".voice-engine/**", ".saktts-data/**"],
  },
};

export default nextConfig;
