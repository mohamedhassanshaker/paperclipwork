import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Separate from vitest.config.ts (jsdom, component tests) on purpose: these
// tests exercise the API route handlers directly against a real Postgres and
// must run in Node, sequentially, against a single shared database.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    globalSetup: ['./tests/integration/setup/global-setup.ts'],
    setupFiles: ['./tests/integration/setup/per-file-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    server: {
      // `next-auth`'s package entry imports the extensionless `next/server`
      // subpath; `next@15.5.27` ships no `exports` map, so plain Node ESM
      // resolution (used for externalised deps) fails with ERR_MODULE_NOT_FOUND.
      // Routing it through Vite's own resolver instead (same as Next's own
      // bundler would) fixes it.
      deps: { inline: [/next-auth/, /@auth\/core/] },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
