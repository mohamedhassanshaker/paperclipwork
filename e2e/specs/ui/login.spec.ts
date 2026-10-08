import { expect, test } from '@playwright/test'
import { LOCALES } from '../../support/fixtures'
import { loginViaUi } from '../../support/auth'

const COPY = {
  en: {
    errEmail: 'Enter a valid email address.',
    errPassword: 'Password must be at least 8 characters.',
    rateLimited: 'Too many sign-in attempts. Try again in a few minutes.',
    signOut: 'Sign out',
    dashboard: 'Dashboard',
  },
  ar: {
    errEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
    errPassword: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    rateLimited: 'محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد بضع دقائق.',
    signOut: 'تسجيل الخروج',
    dashboard: 'لوحة التحكم',
  },
} as const

for (const locale of LOCALES) {
  test.describe(`login (${locale})`, () => {
    test('a malformed email is rejected client-side with no network call', async ({ page }) => {
      await page.goto(`/${locale}/login`)
      await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill('not-an-email')
      await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill('whatever-8-plus')
      await page.getByRole('button', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in' }).click()
      await expect(page.getByRole('alert')).toHaveText(COPY[locale].errEmail)
    })

    test('a password under 8 characters is rejected client-side', async ({ page }) => {
      await page.goto(`/${locale}/login`)
      await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill('someone@example.com')
      await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill('short1')
      await page.getByRole('button', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in' }).click()
      await expect(page.getByRole('alert')).toHaveText(COPY[locale].errPassword)
    })

    test('a correct login reaches the dashboard and can sign out', async ({ page }) => {
      await loginViaUi(page, locale, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`))
      await expect(page.getByText(COPY[locale].dashboard, { exact: true }).first()).toBeVisible()

      await page.getByRole('button', { name: COPY[locale].signOut }).click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`))
    })

    test('an unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
      await page.goto(`/${locale}/dashboard`)
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`))
    })

    test('a throttled login shows the rate-limit message, not the generic password error', async ({ page, request }) => {
      const email = `ui-throttle-${locale}@example.com`
      const ip = locale === 'ar' ? '203.0.113.61' : '203.0.113.62'

      for (let i = 0; i < 10; i++) {
        const csrfRes = await request.get('/api/auth/csrf', { headers: { 'x-forwarded-for': ip } })
        const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
        await request.post('/api/auth/callback/credentials', {
          headers: { 'x-forwarded-for': ip },
          form: { email, password: 'wrong-password', csrfToken },
        })
      }

      await page.goto(`/${locale}/login`)
      await page.getByLabel(locale === 'ar' ? 'البريد الإلكتروني' : 'Email').fill(email)
      await page.getByLabel(locale === 'ar' ? 'كلمة المرور' : 'Password').fill('wrong-password')
      await page.getByRole('button', { name: locale === 'ar' ? 'تسجيل الدخول' : 'Sign in' }).click()
      await expect(page.getByRole('alert')).toHaveText(COPY[locale].rateLimited)
    })
  })
}
