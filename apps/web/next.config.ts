import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable transpiling of workspace packages
  transpilePackages: ["@leet99/contracts", "@leet99/ui"],

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
