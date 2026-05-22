import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet v5 is ESM-only; webpack (used by Vercel) needs to transpile it.
  // Turbopack handles ESM natively so this has no effect locally.
  transpilePackages: ["react-leaflet"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jaksulyiodzswlbrqyev.supabase.co",
      },
    ],
  },
};

export default nextConfig;
