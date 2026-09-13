import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@vis.gl/react-google-maps"],
  },
};

export default nextConfig;
