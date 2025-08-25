// This file exists to configure Cloudflare Pages Functions
// The compatibility flags should be picked up from wrangler.toml
export const onRequest = async (context) => {
  // Pass through to the Next.js worker
  return context.next();
};
