import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingExcludes: {
    "**/*": [".voice-engine/**", ".saktts-data/**"],
  },
};

export default nextConfig;
