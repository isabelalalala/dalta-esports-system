import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'standalone' is for the Docker image (see Dockerfile). Vercel builds the app its own way,
  // so it is skipped there (VERCEL is set during Vercel builds).
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    // Site images live in the public Supabase `site-images` bucket
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : '**.supabase.co',
      },
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
