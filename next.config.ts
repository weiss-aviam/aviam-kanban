import type { NextConfig } from "next";

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

export default nextConfig;
