import fs from 'node:fs';
import path from 'node:path';

const workerPath = path.resolve('.vercel/output/static/_worker.js/index.js');

try {
  if (!fs.existsSync(workerPath)) {
    console.error(`[enable-nodejs-compat] Worker file not found at ${workerPath}`);
    process.exit(1);
  }
  const original = fs.readFileSync(workerPath, 'utf8');

  if (/export\s+const\s+compatibility_flags\s*=/.test(original)) {
    console.log('[enable-nodejs-compat] compatibility_flags already present. Skipping injection.');
    process.exit(0);
  }

  // Add compatibility configuration at the top of the worker
  const header = `// Cloudflare Pages Functions configuration
export const compatibility_date = '2024-08-01';
export const compatibility_flags = ['nodejs_compat'];

`;

  const updated = header + original;
  fs.writeFileSync(workerPath, updated, 'utf8');
  console.log('[enable-nodejs-compat] Injected nodejs_compat into Pages worker.');
} catch (err) {
  console.error('[enable-nodejs-compat] Failed to inject nodejs_compat:', err);
  process.exit(1);
}

