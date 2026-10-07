import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type ChildProcessByStdio, spawn } from 'node:child_process'
import type { Readable } from 'node:stream'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { resetDatabase } from './helpers'

/**
 * Every other integration test exercises route handlers directly
 * (`GET(...)`, `authorizeCredentials(...)`), which is exactly what let
 * middleware.ts redirect /api/auth/* and /api/health to /login without any
 * test noticing (TAH-30): nothing in the suite ever imported middleware.ts,
 * went through Auth.js's real CSRF/cookie dance, or saw an HTTP status code
 * middleware itself produced. This file runs the actual Next.js server as a
 * subprocess and drives it with real `fetch()` calls, the only way to catch
 * a middleware routing defect like this one.
 *
 * The local ephemeral PGlite backend (see setup/global-setup.ts) accepts a
 * single socket connection at a time, so this file's own Prisma connection
 * is released (`$disconnect`) before the server subprocess starts, and only
 * reacquired (implicitly, on the next query) after the subprocess has been
 * killed.
 */

const EMAIL = 'admin@company.com'
const PASSWORD = 'a-strong-password-123'
const PORT = 41817
const BASE_URL = `http://127.0.0.1:${PORT}`
const SERVER_START_TIMEOUT_MS = 60_000

let server: ChildProcessByStdio<null, Readable, Readable>

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`)
      if (res.status === 200 || res.status === 503) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Server on ${BASE_URL} never became reachable within ${SERVER_START_TIMEOUT_MS}ms`)
}

// Next's dev server can emit more than one Set-Cookie for the same name on
// a single response (observed for the csrf-token cookie under Turbopack
// dev); the JSON body always reflects the last one written, so take the
// last matching cookie rather than the first.
function extractCookie(res: Response, name: string): string | undefined {
  const raw = res.headers.getSetCookie?.() ?? []
  let match: string | undefined
  for (const cookie of raw) {
    if (cookie.startsWith(`${name}=`)) match = cookie.split(';')[0]
  }
  return match
}

async function fetchCsrf(): Promise<{ token: string; cookie: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`)
  expect(res.status).toBe(200)
  const body = (await res.json()) as { csrfToken: string }
  const cookie =
    extractCookie(res, 'authjs.csrf-token') ?? extractCookie(res, '__Host-authjs.csrf-token')
  if (!cookie) throw new Error('csrf cookie missing from /api/auth/csrf response')
  return { token: body.csrfToken, cookie }
}

async function attemptLogin(
  email: string,
  password: string,
): Promise<Response> {
  const { token, cookie } = await fetchCsrf()
  const body = new URLSearchParams({ email, password, csrfToken: token })
  return fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie,
      // Same header next-auth/react's signIn({ redirect: false }) sends: it
      // tells Auth.js to answer with a JSON result (and, on success, a
      // Set-Cookie for the session) instead of its default 302.
      'X-Auth-Return-Redirect': '1',
    },
    body: body.toString(),
  })
}

beforeAll(async () => {
  await resetDatabase()
  await prisma.user.create({
    data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), name: 'Admin' },
  })
  // Release this process's PGlite connection before the subprocess opens its own.
  await prisma.$disconnect()

  server = spawn(
    path.join(process.cwd(), 'node_modules', '.bin', 'next'),
    ['dev', '--turbopack', '-p', String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        AUTH_SECRET: 'test-only-middleware-gate-secret-do-not-use-in-prod',
        PORT: String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  // Drain so the dev server's own compile-log output never backpressures it.
  server.stdout.resume()
  server.stderr.resume()
  await waitForServer()
}, SERVER_START_TIMEOUT_MS + 10_000)

afterAll(async () => {
  // Safety net only: the last test already stops the subprocess on the
  // success path. This covers an earlier test failing before that point.
  if (server && !server.killed) {
    server.kill('SIGTERM')
    await new Promise((resolve) => server.once('exit', resolve))
  }
  await resetDatabase()
}, 20_000)

describe('middleware auth/health gate — real HTTP', () => {
  it('lets an unauthenticated GET /api/health through to 200', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok', db: 'ok' })
  })

  it('lets unauthenticated Auth.js routes through to 200', async () => {
    const csrf = await fetch(`${BASE_URL}/api/auth/csrf`)
    expect(csrf.status).toBe(200)

    const session = await fetch(`${BASE_URL}/api/auth/session`)
    expect(session.status).toBe(200)

    const providers = await fetch(`${BASE_URL}/api/auth/providers`)
    expect(providers.status).toBe(200)
  })

  it('still 401s unauthenticated requests to protected API prefixes', async () => {
    const customers = await fetch(`${BASE_URL}/api/customers`)
    expect(customers.status).toBe(401)

    const stats = await fetch(`${BASE_URL}/api/dashboard/stats`)
    expect(stats.status).toBe(401)
  })

  it('still redirects an unauthenticated page request to /en/login', async () => {
    const res = await fetch(`${BASE_URL}/en/dashboard`, { redirect: 'manual' })
    expect([302, 307]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/en/login')
  })

  it('completes a real credentials login over HTTP and sets the session cookie', async () => {
    const res = await attemptLogin(EMAIL, PASSWORD)
    const sessionCookie =
      extractCookie(res, 'authjs.session-token') ??
      extractCookie(res, '__Secure-authjs.session-token')
    expect(sessionCookie).toBeDefined()

    const authed = await fetch(`${BASE_URL}/api/customers`, {
      headers: { cookie: sessionCookie! },
    })
    expect(authed.status).toBe(200)
  })

  const throttleEmail = 'throttle-target@company.com'

  it(
    'throttles repeated failed logins with a real 429 and Retry-After',
    async () => {
      // A failed credentials attempt is a normal 200 with an error code in
      // its JSON body (Auth.js's JSON-mode contract), not an HTTP error — so
      // this polls for the throttle to trip rather than asserting on each
      // individual attempt's status.
      let last: Response | undefined
      for (let i = 0; i < 15; i++) {
        last = await attemptLogin(throttleEmail, 'definitely-wrong')
        if (last.status === 429) break
      }

      expect(last?.status).toBe(429)
      expect(last?.headers.get('retry-after')).toMatch(/^\d+$/)
      await expect(last?.json()).resolves.toMatchObject({ error: 'rate_limited' })
    },
    30_000,
  )

  it('persisted the throttled attempts as real LoginAttempt rows', async () => {
    // Stop the subprocess first: the local PGlite backend only accepts one
    // socket connection at a time (see beforeAll), so this process's own
    // Prisma client cannot query until the subprocess's connection is closed.
    server.kill('SIGTERM')
    await new Promise((resolve) => server.once('exit', resolve))

    const count = await prisma.loginAttempt.count({ where: { email: throttleEmail } })
    expect(count).toBeGreaterThanOrEqual(10)
  })
})
