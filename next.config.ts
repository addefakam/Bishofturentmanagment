import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  // Removed output: "standalone" - Vercel manages its own output format
  // standalone output causes .nft.json trace failures on Vercel with Next.js 16
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "pg", "bcryptjs"],
};

export default nextConfig;
