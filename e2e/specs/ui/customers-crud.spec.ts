import { expect, test } from '@playwright/test'
import { LOCALES, SEEDED_CUSTOMERS } from '../../support/fixtures'
import { loginViaUi } from '../../support/auth'

const COPY = {
  en: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    addBtn: '+ Add customer',
    fullName: 'Full name',
    email: 'Email',
    create: 'Create customer',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    deleteMsg: (name: string) => `This permanently removes ${name}. This action cannot be undone.`,
    emptyTitle: 'No customers found',
    emptySub: 'Try a different search or add a new customer.',
    searchPh: 'Search name, email or company…',
    errName: 'Name is required.',
    errEmail: 'Enter a valid email address.',
    toastCreated: 'Customer created',
    toastUpdated: 'Customer updated',
    toastDeleted: 'Customer deleted',
    count: (shown: number, total: number) => `${shown} of ${total} customers`,
  },
  ar: {
    dashboard: 'لوحة التحكم',
    customers: 'العملاء',
    addBtn: '+ إضافة عميل',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    create: 'إنشاء العميل',
    saveChanges: 'حفظ التغييرات',
    cancel: 'إلغاء',
    edit: 'تعديل',
    delete: 'حذف',
    deleteMsg: (name: string) => `سيتم حذف ${name} نهائياً. لا يمكن التراجع عن هذا الإجراء.`,
    emptyTitle: 'لم يتم العثور على عملاء',
    emptySub: 'جرّب بحثاً مختلفاً أو أضف عميلاً جديداً.',
    searchPh: 'ابحث بالاسم أو البريد أو الشركة…',
    errName: 'الاسم مطلوب.',
    errEmail: 'أدخل بريداً إلكترونياً صحيحاً.',
    toastCreated: 'تم إنشاء العميل',
    toastUpdated: 'تم تحديث العميل',
    toastDeleted: 'تم حذف العميل',
    count: (shown: number, total: number) => `${shown} من ${total} عميل`,
  },
} as const

/** Unique per-test tag so parallel-ish assertions never collide with seed data or other tests' rows. */
function unique(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function createCustomerViaApi(
  page: import('@playwright/test').Page,
  data: { name: string; email: string; status?: 'active' | 'inactive' },
) {
  // Uses page.request, which shares the browser context's session cookie —
  // real authenticated setup, no separate login plumbing needed per call.
  const res = await page.request.post('/api/customers', {
    data: { status: 'active', ...data },
  })
  if (!res.ok()) {
    throw new Error(`Fixture setup failed: POST /api/customers ${res.status()}: ${await res.text()}`)
  }
  return (await res.json()) as { id: string }
}

for (const locale of LOCALES) {
  test.describe(`customers CRUD (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await loginViaUi(page, locale, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
      await page.goto(`/${locale}/customers`)
    })

    test('creating a customer shows a success toast and the new row appears in the table', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('create')
      const name = `E2E Create ${tag}`
      const email = `${tag}@example.com`

      await page.getByRole('button', { name: copy.addBtn }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByLabel(copy.fullName).fill(name)
      await page.getByLabel(copy.email).fill(email)
      await page.getByRole('button', { name: copy.create }).click()

      await expect(page.getByRole('status')).toHaveText(copy.toastCreated)
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(page.getByText(name)).toBeVisible()
    })

    test('editing a customer updates the row and shows a success toast', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('edit')
      const originalName = `E2E Edit Original ${tag}`
      const updatedName = `E2E Edit Updated ${tag}`
      await createCustomerViaApi(page, { name: originalName, email: `${tag}@example.com` })

      await page.goto(`/${locale}/customers?q=${encodeURIComponent(tag)}`)
      await expect(page.getByText(originalName)).toBeVisible()

      await page.getByRole('button', { name: copy.edit }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByLabel(copy.fullName).fill(updatedName)
      await page.getByRole('button', { name: copy.saveChanges }).click()

      await expect(page.getByRole('status')).toHaveText(copy.toastUpdated)
      await expect(page.getByText(updatedName)).toBeVisible()
    })

    test('deleting a customer requires confirmation in the dialog', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('delete-confirm')
      const name = `E2E Delete Confirm ${tag}`
      await createCustomerViaApi(page, { name, email: `${tag}@example.com` })

      await page.goto(`/${locale}/customers?q=${encodeURIComponent(tag)}`)
      await page.getByRole('button', { name: copy.delete }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText(copy.deleteMsg(name))).toBeVisible()

      await dialog.getByRole('button', { name: copy.delete }).click()
      await expect(page.getByRole('status')).toHaveText(copy.toastDeleted)
      await expect(page.getByText(name)).toHaveCount(0)
    })

    test('cancelling the delete confirmation leaves the row untouched', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('delete-cancel')
      const name = `E2E Delete Cancel ${tag}`
      await createCustomerViaApi(page, { name, email: `${tag}@example.com` })

      await page.goto(`/${locale}/customers?q=${encodeURIComponent(tag)}`)
      await page.getByRole('button', { name: copy.delete }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: copy.cancel }).click()

      await expect(dialog).toBeHidden()
      await expect(page.getByText(name)).toBeVisible()
    })

    test('searching by name/email/company filters the table to matching rows', async ({ page }) => {
      const target = SEEDED_CUSTOMERS[0]
      const other = SEEDED_CUSTOMERS[1]

      await page.getByLabel(COPY[locale].searchPh).fill('northwind')
      await expect(page).toHaveURL(/q=northwind/)
      await expect(page.getByText(target.name)).toBeVisible()
      await expect(page.getByText(other.name)).toHaveCount(0)
    })

    test('a search with no matches shows the empty state, not an empty table', async ({ page }) => {
      const copy = COPY[locale]
      await page.getByLabel(copy.searchPh).fill('zzz-no-such-customer-zzz')
      await expect(page).toHaveURL(/q=zzz-no-such-customer-zzz/)
      await expect(page.getByText(copy.emptyTitle)).toBeVisible()
      await expect(page.getByText(copy.emptySub)).toBeVisible()
    })

    test('the "{n} of {m} customers" counter reflects the active filter', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('counter')
      await createCustomerViaApi(page, { name: `E2E Counter ${tag}`, email: `${tag}@example.com` })

      const listRes = await page.request.get(`/api/customers?q=${encodeURIComponent(tag)}`)
      const { total, totalAll } = (await listRes.json()) as { total: number; totalAll: number }
      expect(total).toBe(1)

      await page.goto(`/${locale}/customers?q=${encodeURIComponent(tag)}`)
      await expect(page.getByText(copy.count(total, totalAll))).toBeVisible()
    })

    test('the create/edit dialog shows field-level validation errors (name required, invalid email)', async ({ page }) => {
      const copy = COPY[locale]
      await page.getByRole('button', { name: copy.addBtn }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel(copy.email).fill('not-an-email')
      await page.getByRole('button', { name: copy.create }).click()

      await expect(page.getByText(copy.errName)).toBeVisible()
      await expect(page.getByText(copy.errEmail)).toBeVisible()
      // Validation is client-side; a rejected submit must not have closed the dialog.
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('the create/edit dialog traps focus and closes on Escape', async ({ page }) => {
      const copy = COPY[locale]
      await page.getByRole('button', { name: copy.addBtn }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Last focusable element in the panel is the submit button; Tab from
      // there must wrap back to the first field, not escape to the page.
      await page.getByRole('button', { name: copy.create }).focus()
      await page.keyboard.press('Tab')
      await expect(page.getByLabel(copy.fullName)).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    })

    test('keyboard-only: tab from the customers table through "Add customer" to a saved row', async ({ page }) => {
      const copy = COPY[locale]
      const tag = unique('kbnav')
      const name = `E2E Keyboard Nav ${tag}`
      await createCustomerViaApi(page, { name, email: `${tag}@example.com` })

      await page.goto(`/${locale}/customers?q=${encodeURIComponent(tag)}`)
      await expect(page.getByText(name)).toBeVisible()

      await page.getByLabel(copy.searchPh).focus()
      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: copy.addBtn })).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: copy.edit })).toBeFocused()
    })

    test('the toast auto-dismisses after its ~2200ms window without an arbitrary waitForTimeout in the assertion', async ({
      page,
    }) => {
      const copy = COPY[locale]
      const tag = unique('toast-dismiss')
      await page.getByRole('button', { name: copy.addBtn }).click()
      await page.getByLabel(copy.fullName).fill(`E2E Toast ${tag}`)
      await page.getByLabel(copy.email).fill(`${tag}@example.com`)
      await page.getByRole('button', { name: copy.create }).click()

      const toast = page.getByRole('status')
      await expect(toast).toHaveText(copy.toastCreated)
      // Web-first assertion with its own auto-wait timeout, not a sleep —
      // the 2200ms auto-dismiss (ToastProvider) must fire on its own.
      await expect(toast).toBeHidden({ timeout: 4000 })
    })
  })

  test.describe(`phone column LTR pinning (${locale})`, () => {
    test('the phone column stays LTR (pinned) even when the page is RTL (Arabic)', async ({ page }) => {
      test.skip(locale !== 'ar', 'LTR pinning is only a meaningful assertion under an RTL document')
      await loginViaUi(page, locale, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)

      const target = SEEDED_CUSTOMERS[1] // Omar Haddad, +971 50 123 4567
      await page.goto(`/${locale}/customers?q=${encodeURIComponent(target.email)}`)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      const phoneCell = page.getByText(target.phone, { exact: true })
      await expect(phoneCell).toBeVisible()
      await expect(phoneCell).toHaveAttribute('dir', 'ltr')
    })
  })

  test.describe(`dashboard ↔ customers navigation (${locale})`, () => {
    test('the sidebar nav moves between Dashboard and Customers', async ({ page }) => {
      const copy = COPY[locale]
      await loginViaUi(page, locale, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`))

      await page.getByRole('link', { name: copy.customers }).click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/customers$`))

      await page.getByRole('link', { name: copy.dashboard }).click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard$`))
    })
  })
}
