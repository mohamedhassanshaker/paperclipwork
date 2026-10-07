import type { APIRequestContext, Page } from '@playwright/test'
import type { E2ELocale } from './fixtures'

/** Drives the real sign-in form exactly as a user would — no API shortcuts. */
export async function loginViaUi(
  page: Page,
  locale: E2ELocale,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`/${locale}/login`)
  await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill(email)
  await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill(password)
  await page.getByRole('button', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in' }).click()
}

/**
 * Authenticates the shared `request` fixture's cookie jar over real HTTP —
 * CSRF token, then the credentials callback — so API-only specs can reach
 * protected routes without a browser. Returns the callback response so
 * callers can assert on it directly when that's the point of the test.
 */
export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const csrfRes = await request.get('/api/auth/csrf')
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  // maxRedirects: 0 is deliberate — Auth.js answers a successful credentials
  // callback with a 302 carrying the session cookie. Letting Playwright
  // auto-follow it chases the redirect through middleware's own locale/page
  // handling, where the Set-Cookie from this exact hop is what callers need
  // to assert on; following further hops only risks losing it.
  return request.post('/api/auth/callback/credentials', {
    form: { email, password, csrfToken },
    maxRedirects: 0,
  })
}
