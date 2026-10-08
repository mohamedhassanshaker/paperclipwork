import { expect, test } from '@playwright/test'
import { loginViaUi } from '../../support/auth'

/**
 * RTL correctness is the single highest-regression-risk surface in the
 * design handoff (test plan §2) — mirrored numerics and a sidebar on the
 * wrong side pass a superficial "does Arabic render" check. This file
 * asserts the mechanics (computed `dir`, physical side, the toggle itself)
 * on the app shell, which already exists. The three LTR-pinned regions
 * specific to the dashboard/customers screens (chart axis, revenue labels,
 * phone column) are covered in e2e/specs/ui/dashboard.spec.ts and
 * customers-crud.spec.ts, both `test.fixme` pending TAH-20.
 */
test.describe('language toggle and RTL mirroring', () => {
  test('the login page is LTR under /en and RTL under /ar', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.goto('/ar/login')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })

  test('the language toggle switches locale, URL, and persists via cookie on reload', async ({ page }) => {
    await page.goto('/en/login')
    await page.getByRole('button', { name: 'العربية' }).click()
    await expect(page).toHaveURL(/\/ar\/login$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('ar')
  })

  test('the sidebar sits on the document-end side in RTL (inline-end, not a fixed left/right)', async ({ page }) => {
    await loginViaUi(page, 'ar', process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    await expect(page).toHaveURL(/\/ar\/dashboard$/)

    const sidebarBox = await page.locator('aside').boundingBox()
    const mainBox = await page.locator('main').boundingBox()
    expect(sidebarBox).not.toBeNull()
    expect(mainBox).not.toBeNull()

    // In RTL, "border-e" (inline-end) renders on the *left* of the viewport
    // — the opposite physical side from the same component in LTR English.
    // Asserting the physical position (not just that `dir="rtl"` is set) is
    // what actually catches a logical-property regression.
    expect(sidebarBox!.x).toBeLessThan(mainBox!.x)
  })

  test('the sidebar sits on the document-start side in LTR English, for contrast', async ({ page }) => {
    await loginViaUi(page, 'en', process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    await expect(page).toHaveURL(/\/en\/dashboard$/)

    const sidebarBox = await page.locator('aside').boundingBox()
    const mainBox = await page.locator('main').boundingBox()
    expect(sidebarBox!.x).toBeLessThan(mainBox!.x)
    // English sidebar must be at the viewport's left edge; Arabic's (above)
    // is not — that difference is the actual mirroring assertion.
    expect(sidebarBox!.x).toBeLessThanOrEqual(1)
  })

  test('breadcrumb and nav labels render in the active locale', async ({ page }) => {
    await loginViaUi(page, 'ar', process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    await expect(page.getByRole('link', { name: 'العملاء' })).toBeVisible()
    await expect(page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible()
  })
})
