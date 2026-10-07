import { expect, test } from '@playwright/test'

// AC from TAH-30 (SEC-07): the health probe must stay public — Railway's
// health checks, the deployment health gate, and canary verification all
// hit this unauthenticated.
test('GET /api/health is reachable without a session and reports ok', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status(), await res.text()).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok', db: 'ok' })
})
