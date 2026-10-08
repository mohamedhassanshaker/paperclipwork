import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4310)
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Deliberately `workers: 1` / `fullyParallel: false`: every spec shares one
 * Postgres instance, and the login-throttle and customer-list specs read
 * global counters/rows. Serial execution trades suite speed for the thing
 * this gate exists to guarantee — no flake from cross-test interference. See
 * e2e/global-setup.ts for how the shared database and app server come up.
 */
export default defineConfig({
  testDir: './e2e/specs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // One WebKit pass dedicated to the RTL/font-rendering suite (test plan
    // §6) — not a full second browser matrix for every spec.
    {
      name: 'webkit-rtl',
      testMatch: /language-rtl-shell\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
