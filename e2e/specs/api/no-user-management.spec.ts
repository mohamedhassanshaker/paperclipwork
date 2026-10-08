import { expect, test } from '@playwright/test'
import { prisma } from '../../support/db'

/**
 * CTO ruling (TAH-23 comment, 2026-10-07): one ops-seeded admin, no
 * self-service registration, no user list, no role model. These routes
 * must not exist — their absence is itself part of the contract, not an
 * oversight to silently tolerate.
 */
// No route.ts exists under app/api/users or app/api/register, so an
// unrecognized /api/* path currently falls through middleware's trailing
// "page" branch and redirects to /login rather than answering 404 — still
// "no functioning API", just via a different status. Accept either shape;
// the point is that none of these ever return a working user-management
// response.
const NO_SURFACE_STATUSES = [404, 401, 302, 307]

test.describe('no user-management surface exists', () => {
  for (const path of ['/api/users', '/api/register']) {
    test(`${path} does not exist`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(NO_SURFACE_STATUSES).toContain(res.status())
    })
  }

  // /api/auth/* is Auth.js's own namespace and middleware must bypass it
  // entirely (TAH-30). Auth.js's catch-all handler answers an unrecognized
  // action like "register" or "forgot-password" with a benign 200 (its
  // generic not-an-action response) rather than a 4xx — verified live.
  // The status code isn't the interesting assertion here; that posting to
  // it never actually creates a user is.
  for (const path of ['/api/auth/register', '/api/auth/forgot-password']) {
    test(`${path} performs no registration side effect`, async ({ request }) => {
      const before = await prisma.user.count()
      await request.post(path, {
        data: { email: `probe-${Date.now()}@example.com`, password: 'whatever8' },
      })
      const after = await prisma.user.count()
      expect(after).toBe(before)
    })
  }
})
