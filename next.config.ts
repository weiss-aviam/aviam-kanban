import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const uploadLimitMb = parseInt(process.env.UPLOAD_MAX_SIZE_MB ?? "10", 10);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: `${uploadLimitMb}mb`,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
};

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  // aggressiveFrontEndNavCaching caches navigation responses via the SW,
  // causing every page navigation to re-run the proxy middleware and trigger
  // a supabase.auth.getUser() call — same pattern as the API-route issue.
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
