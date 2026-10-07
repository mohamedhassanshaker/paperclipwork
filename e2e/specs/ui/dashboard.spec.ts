import { test } from '@playwright/test'

/**
 * Blocked on TAH-20 (see e2e/specs/ui/customers-crud.spec.ts for the same
 * note) — app/[locale]/(app)/dashboard/page.tsx is still the placeholder
 * Card. AC-12/AC-14 (the "Sample data" marker) ship in v1 regardless of the
 * pending HUMAN SME roadmap question (interaction 2f8c5106 on TAH-17), so
 * these are real acceptance criteria to cover, not speculative.
 */
test.describe('dashboard (blocked on TAH-20)', () => {
  test.fixme('stat cards (total/active/inactive) render from real customer data', async () => {});
  test.fixme('the revenue and region cards show a visible "Sample data" marker (AC-14)', async () => {});
  test.fixme('the bar-chart month axis stays LTR even when the page is RTL (Arabic)', async () => {});
  test.fixme('the revenue labels stay LTR even when the page is RTL (Arabic)', async () => {});
  test.fixme('the sample-data cards are inert to customer create/edit/delete mutations', async () => {});
})
