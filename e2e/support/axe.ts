import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const SERIOUS_IMPACTS = new Set(['serious', 'critical'])

/** Fails the test with the full violation list if any serious/critical axe violation is found. */
export async function assertNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => SERIOUS_IMPACTS.has(v.impact ?? ''))
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}
