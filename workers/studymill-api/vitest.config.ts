import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    environment: 'node',
    // Phase 0: run only minimal unit tests that do not require Workers runtime or external services.
    include: ['test/aiSDKService.test.ts', 'test/crypto.test.ts'],
    exclude: [],
    globals: true,
    reporters: ['default']
  }
});

