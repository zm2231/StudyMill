import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
  // Cloudflare Pages configuration
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
};

export default nextConfig;
