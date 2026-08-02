import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "pg", "bcryptjs"],
};

export default nextConfig;