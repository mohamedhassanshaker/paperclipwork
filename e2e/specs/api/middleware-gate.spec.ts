import { expect, test } from '@playwright/test'
import { apiLogin } from '../../support/auth'

/**
 * HTTP-level coverage of the route-protection gate — exactly the layer that
 * hid TAH-30 (SEC-07): the vitest integration suite calls
 * `authorizeCredentials()` directly, bypassing Auth.js's real CSRF/cookie
 * flow, which is why 36 passing unit/integration tests shipped a build
 * where login, the throttle, and the health probe were all unreachable.
 * These assertions are the acceptance criteria from TAH-30 itself.
 */
test.describe('route-protection gate (TAH-30)', () => {
  test('unauthenticated GET /api/auth/csrf returns 200 JSON, not a redirect to /login', async ({ request }) => {
    const res = await request.get('/api/auth/csrf')
    expect(res.status(), await res.text()).toBe(200)
    expect(await res.json()).toHaveProperty('csrfToken')
  })

  test('unauthenticated GET /api/auth/session returns 200 JSON, not a redirect to /login', async ({ request }) => {
    const res = await request.get('/api/auth/session')
    expect(res.status(), await res.text()).toBe(200)
    // A redirect that Playwright silently followed to the (200, HTML) login
    // page would also satisfy a bare status check — this is the assertion
    // that actually distinguishes that from the real endpoint.
    // Auth.js v5's unauthenticated /api/auth/session body: a literal `null`,
    // not `{}` — verified live.
    expect(await res.json()).toBeNull()
  })

  test('unauthenticated GET /api/auth/providers returns 200 JSON, not a redirect to /login', async ({ request }) => {
    const res = await request.get('/api/auth/providers')
    expect(res.status(), await res.text()).toBe(200)
    expect(await res.json()).toHaveProperty('credentials')
  })

  test('unauthenticated GET /api/customers still returns 401, not a redirect', async ({ request }) => {
    const res = await request.get('/api/customers')
    expect(res.status()).toBe(401)
    // Middleware's own gate short-circuits here with `{ error: "unauthorized" }`
    // (middleware.ts) — a plainer envelope than the route handler's own
    // requireSession()/errorResponse("unauthorized", "Authentication
    // required.") in lib/api-response.ts, which only fires if a request gets
    // past middleware with a session that the route's own auth() call then
    // rejects. Match what unauthenticated traffic actually hits.
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
  })

  test('unauthenticated GET /api/dashboard/stats still returns 401', async ({ request }) => {
    const res = await request.get('/api/dashboard/stats')
    expect(res.status()).toBe(401)
  })

  test('unauthenticated GET /en/dashboard (a page) still redirects to /en/login', async ({ request }) => {
    const res = await request.get('/en/dashboard', { maxRedirects: 0 })
    expect([302, 307]).toContain(res.status())
    expect(res.headers()['location']).toContain('/en/login')
  })

  test('a correct-password login reaches Auth.js and sets a real session cookie', async ({ request }) => {
    const email = process.env.E2E_ADMIN_EMAIL!
    const password = process.env.E2E_ADMIN_PASSWORD!
    const res = await apiLogin(request, email, password)

    // Auth.js answers the credentials callback with a redirect on success;
    // the thing that was actually broken (TAH-30) is that it never got this
    // far at all — session-token issuance is the real assertion.
    expect([200, 302, 303]).toContain(res.status())
    const setCookieHeaders = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
    expect(
      setCookieHeaders.some((value) => value.includes('authjs.session-token=')),
      `no authjs.session-token in Set-Cookie: ${JSON.stringify(setCookieHeaders)}`,
    ).toBe(true)
  })
})
