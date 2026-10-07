import { expect, test } from '@playwright/test'
import { LOCALES } from '../../support/fixtures'
import { loginViaUi } from '../../support/auth'

const COPY = {
  en: {
    total: 'Total customers',
    active: 'Active',
    inactive: 'Inactive',
    sampleDataLabel: 'Sample data',
    revLabels: ['Oct', 'Jan', 'Apr', 'Jul', 'Sep'],
  },
  ar: {
    total: 'إجمالي العملاء',
    active: 'نشط',
    inactive: 'غير نشط',
    sampleDataLabel: 'بيانات تجريبية',
    revLabels: ['أكتوبر', 'يناير', 'أبريل', 'يوليو', 'سبتمبر'],
  },
} as const

function unique(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

for (const locale of LOCALES) {
  test.describe(`dashboard (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUi(page, locale, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
    })

    test('stat cards (total/active/inactive) render from real customer data', async ({ page }) => {
      const copy = COPY[locale]
      const statsRes = await page.request.get('/api/dashboard/stats')
      const stats = (await statsRes.json()) as { total: number; active: number; inactive: number }

      // ".text-30.font-semibold.tracking-heading" is the stat-card value's
      // own class combination — unique on the page (Donut's center % is
      // text-26, the revenue headline is text-18), so index order (total,
      // active, inactive) matches the dashboard page's statCards array.
      const statValues = page.locator('.text-30.font-semibold.tracking-heading')
      await expect(statValues).toHaveCount(3)
      await expect(page.getByText(copy.total, { exact: true })).toBeVisible()
      await expect(statValues.nth(0)).toHaveText(String(stats.total))
      await expect(page.getByText(copy.active, { exact: true }).first()).toBeVisible()
      await expect(statValues.nth(1)).toHaveText(String(stats.active))
      await expect(statValues.nth(2)).toHaveText(String(stats.inactive))
    })

    test('the revenue and region cards show a visible "Sample data" marker (AC-14)', async ({ page }) => {
      const copy = COPY[locale]
      const badges = page.getByText(copy.sampleDataLabel, { exact: true })
      await expect(badges).toHaveCount(2)
      await expect(badges.first()).toBeVisible()
      await expect(badges.last()).toBeVisible()
    })

    test('the bar-chart month axis stays LTR even when the page is RTL (Arabic)', async ({ page }) => {
      test.skip(locale !== 'ar', 'LTR pinning is only a meaningful assertion under an RTL document')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

      // BarChart.tsx's month-label row: the only `dir="ltr"` element with
      // this exact class combination (its sibling bar-track row also has
      // dir="ltr" but no `gap-2`-only class match).
      const axisLabels = page.locator('div[dir="ltr"].-mt-2.flex.gap-2')
      await expect(axisLabels).toHaveAttribute('dir', 'ltr')
      const direction = await axisLabels.evaluate((el) => getComputedStyle(el).direction)
      expect(direction).toBe('ltr')
    })

    test('the revenue labels stay LTR even when the page is RTL (Arabic)', async ({ page }) => {
      test.skip(locale !== 'ar', 'LTR pinning is only a meaningful assertion under an RTL document')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

      const copy = COPY[locale]
      const revenueLabels = page.locator('div[dir="ltr"].justify-between.text-11.text-fg-muted')
      await expect(revenueLabels).toHaveAttribute('dir', 'ltr')
      const direction = await revenueLabels.evaluate((el) => getComputedStyle(el).direction)
      expect(direction).toBe('ltr')

      // The actual mirrored-numerics regression: labels must render in
      // calendar order left-to-right, not reversed by the RTL document.
      const texts = await revenueLabels.locator('span').allTextContents()
      expect(texts).toEqual(copy.revLabels)
    })

    test('the sample-data cards are inert to customer create/edit/delete mutations', async ({ page }) => {
      const copy = COPY[locale]
      // ".text-18.font-semibold.tracking-heading" is the revenue headline's
      // own class combination (distinct from the stat-card's text-30 and
      // Donut's text-26), driven entirely by lib/demo-data.ts.
      const revenueHeadline = page.locator('.text-18.font-semibold.tracking-heading')
      const before = await revenueHeadline.textContent()

      const tag = unique('inert')
      const created = await page.request.post('/api/customers', {
        data: { name: `E2E Inert ${tag}`, email: `${tag}@example.com`, status: 'active' },
      })
      const { id } = (await created.json()) as { id: string }

      await page.reload()
      await expect(revenueHeadline).toHaveText(before ?? '')
      await expect(page.getByText(copy.sampleDataLabel, { exact: true })).toHaveCount(2)

      await page.request.delete(`/api/customers/${id}`)
    })
  })
}
