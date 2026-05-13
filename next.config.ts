import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["mongoose"],
  turbopack: {},
};

export default nextConfig;
