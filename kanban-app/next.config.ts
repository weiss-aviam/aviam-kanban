import type { NextConfig } from "next";

// Configure sub-path hosting via environment variables
// Set NEXT_PUBLIC_BASE_PATH="/kanban" when serving under https://domain/kanban/
// Optionally set NEXT_PUBLIC_SITE_URL to your full origin, e.g., "https://aviam.intranet"
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  // Only set basePath when provided
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  poweredByHeader: false,
  // Skip ESLint during production builds to avoid blocking on warnings/strict rules
  eslint: { ignoreDuringBuilds: true },
  // If you use next/image with a reverse proxy under a base path, Next handles basePath automatically.
  // Add additional config here if needed (e.g., images.remotePatterns, headers, etc.)
};

export default nextConfig;
