import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
  // Disable Next.js prefetching to prevent .txt 404 errors
  experimental: {
    optimizeCss: false,
  },
  // Cloudflare Pages configuration
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
