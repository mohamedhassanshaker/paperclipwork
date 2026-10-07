import { test } from '@playwright/test'

/**
 * Blocked on TAH-20 (Screens — Dashboard, Customers table, create/edit
 * dialog, delete confirm, toast): app/[locale]/(app)/customers/page.tsx is
 * still the placeholder Card from the frontend-foundation scaffold, not the
 * real screen. These `test.fixme`s are the home for the acceptance criteria
 * this file will cover the moment TAH-20 lands — tracked here rather than
 * silently missing, so the trace matrix in the test-plan document has a
 * real row to point at. Do not delete; replace the body and drop `.fixme`.
 */
test.describe('customers CRUD (blocked on TAH-20)', () => {
  test.fixme('creating a customer shows a success toast and the new row appears in the table', async () => {});
  test.fixme('editing a customer updates the row and shows a success toast', async () => {});
  test.fixme('deleting a customer requires confirmation in the dialog', async () => {});
  test.fixme('cancelling the delete confirmation leaves the row untouched', async () => {});
  test.fixme('searching by name/email/company filters the table to matching rows', async () => {});
  test.fixme('a search with no matches shows the empty state, not an empty table', async () => {});
  test.fixme('the "{n} of {m} customers" counter reflects the active filter', async () => {});
  test.fixme('the create/edit dialog shows field-level validation errors (name required, invalid email)', async () => {});
  test.fixme('the create/edit dialog traps focus and closes on Escape', async () => {});
  test.fixme('keyboard-only: tab from the customers table through "Add customer" to a saved row', async () => {});
  test.fixme('the phone column stays LTR (pinned) even when the page is RTL (Arabic)', async () => {});
  test.fixme('the toast auto-dismisses after its ~2200ms window without an arbitrary waitForTimeout in the assertion', async () => {});
})
