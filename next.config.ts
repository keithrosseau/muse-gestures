import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output automatically; "standalone" is fine for self-hosting
  // but unnecessary on Vercel. Kept here for portability — Vercel ignores it.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
