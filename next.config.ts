import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet v5 is ESM-only; webpack (used by Vercel) needs to transpile it.
  // Turbopack handles ESM natively so this has no effect locally.
  transpilePackages: ["react-leaflet"],

  // Headless Chromium (Court Packet PDF rendering) must stay a real
  // node_modules dependency — bundling it breaks its binary lookup — and its
  // compressed browser binary has to be traced into the serverless function.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/court-packet/render": ["./node_modules/@sparticuz/chromium/bin/**"],
  },

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
