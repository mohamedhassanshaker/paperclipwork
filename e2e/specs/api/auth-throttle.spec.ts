import { expect, test } from '@playwright/test'
import { prisma, resetLoginAttempts } from '../../support/db'
import { apiLogin } from '../../support/auth'

/**
 * interface-contract §4.1. The BA ruled out account lockout *because* this
 * throttle is the only control left against online password guessing
 * (TAH-17 §10) — it needs real coverage, not a smoke test. One IP per test
 * (via a Playwright request context with a custom extraHTTPHeaders) keeps
 * the per-IP and per-email counters from bleeding across tests even though
 * the suite runs serially against one shared database.
 */

async function failedAttempt(request: import('@playwright/test').APIRequestContext, email: string, ip: string) {
  const csrfRes = await request.get('/api/auth/csrf', { headers: { 'x-forwarded-for': ip } })
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  return request.post('/api/auth/callback/credentials', {
    headers: { 'x-forwarded-for': ip },
    form: { email, password: 'definitely-wrong-password', csrfToken },
  })
}

test.describe('login throttle (interface-contract §4.1)', () => {
  test.beforeEach(async () => {
    await resetLoginAttempts()
  })

  test('the 11th failed attempt in the window returns 429 with a Retry-After header', async ({ request }) => {
    const email = 'throttle-11th@example.com'
    const ip = '203.0.113.11'

    for (let i = 0; i < 10; i++) {
      const res = await failedAttempt(request, email, ip)
      expect(res.status(), `attempt ${i + 1} should not yet be throttled`).not.toBe(429)
    }

    const eleventh = await failedAttempt(request, email, ip)
    expect(eleventh.status()).toBe(429)
    expect(eleventh.headers()['retry-after']).toMatch(/^\d+$/)
    expect(await eleventh.json()).toEqual({
      error: 'rate_limited',
      message: 'Too many sign-in attempts. Try again in a few minutes.',
    })
  })

  test('a successful login resets that identity\'s counter', async ({ request }) => {
    const email = process.env.E2E_ADMIN_EMAIL!
    const password = process.env.E2E_ADMIN_PASSWORD!
    const ip = '203.0.113.12'

    for (let i = 0; i < 9; i++) {
      await failedAttempt(request, email, ip)
    }

    const success = await apiLogin(request, email, password)
    expect(success.status(), 'the correct password should still succeed at 9 prior failures').not.toBe(429)

    // Counter reset by success — ten more failures are needed again, not one.
    for (let i = 0; i < 10; i++) {
      const res = await failedAttempt(request, email, ip)
      expect(res.status(), `post-reset attempt ${i + 1} should not yet be throttled`).not.toBe(429)
    }
    const eleventh = await failedAttempt(request, email, ip)
    expect(eleventh.status()).toBe(429)
  })

  test('the 429 response is indistinguishable for a real vs. a non-existent email', async ({ request }) => {
    const knownEmail = process.env.E2E_ADMIN_EMAIL!
    const unknownEmail = 'nobody-at-all@example.com'
    const ipKnown = '203.0.113.21'
    const ipUnknown = '203.0.113.22'

    for (let i = 0; i < 10; i++) await failedAttempt(request, knownEmail, ipKnown)
    for (let i = 0; i < 10; i++) await failedAttempt(request, unknownEmail, ipUnknown)

    const knownRes = await failedAttempt(request, knownEmail, ipKnown)
    const unknownRes = await failedAttempt(request, unknownEmail, ipUnknown)

    expect(knownRes.status()).toBe(429)
    expect(unknownRes.status()).toBe(429)
    expect(await knownRes.json()).toEqual(await unknownRes.json())
  })

  test('per-IP and per-email counters trip independently', async ({ request }) => {
    // Same IP, 10 different emails: trips the IP counter even though no
    // single email counter reached 10.
    const ip = '203.0.113.31'
    for (let i = 0; i < 10; i++) {
      await failedAttempt(request, `distinct-${i}@example.com`, ip)
    }
    const res = await failedAttempt(request, 'yet-another-distinct@example.com', ip)
    expect(res.status()).toBe(429)
  })

  test('a sub-8-character password still counts toward the limit, not an un-throttled oracle', async ({ request }) => {
    const email = 'short-password-probe@example.com'
    const ip = '203.0.113.41'

    for (let i = 0; i < 10; i++) {
      const csrfRes = await request.get('/api/auth/csrf', { headers: { 'x-forwarded-for': ip } })
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
      const res = await request.post('/api/auth/callback/credentials', {
        headers: { 'x-forwarded-for': ip },
        form: { email, password: 'short1', csrfToken },
      })
      expect(res.status(), `sub-8-password attempt ${i + 1} should not itself be throttled`).not.toBe(429)
    }

    const eleventh = await failedAttempt(request, email, ip)
    expect(eleventh.status()).toBe(429)
  })

  /**
   * Adversarial check, per the CTO's note: the throttle must be
   * Postgres-backed, not in-process — an in-memory counter passes every
   * single-process test and protects nothing once Railway restarts or runs
   * a second instance. Writing the ten prior "failures" directly via Prisma,
   * from this test process rather than through the running app's own HTTP
   * API, proves the app is reading shared Postgres state it did not produce
   * in its own memory — exactly the property an in-process counter would
   * fail. A full process-restart rehearsal is tracked as a follow-up (see
   * the test plan); this is the practical proxy for it in a single suite run.
   */
  test('the counter is read from Postgres, not in-process memory: rows written by a separate process trip it', async ({
    request,
  }) => {
    const email = 'cross-process-probe@example.com'
    const ip = '203.0.113.51'

    await prisma.loginAttempt.createMany({
      data: Array.from({ length: 10 }, () => ({ ip, email })),
    })

    const res = await failedAttempt(request, email, ip)
    expect(res.status()).toBe(429)
  })
})
