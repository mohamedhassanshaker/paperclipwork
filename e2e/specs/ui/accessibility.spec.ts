import { expect, test } from '@playwright/test'
import { assertNoSeriousA11yViolations } from '../../support/axe'

test.describe('accessibility', () => {
  test('login page has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/en/login')
    await assertNoSeriousA11yViolations(page)
  })

  test('keyboard-only: tab to email, password, and submit; Enter submits the form', async ({ page }) => {
    await page.goto('/en/login')
    await page.keyboard.press('Tab') // -> email
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.keyboard.type('not-an-email')

    await page.keyboard.press('Tab') // -> password
    await expect(page.getByLabel('Password')).toBeFocused()
    await page.keyboard.type('whatever8')

    await page.keyboard.press('Tab') // -> submit button
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')
  })

  test('focused controls show a visible focus ring (interface-contract §5.4: box-shadow, not outline)', async ({ page }) => {
    await page.goto('/en/login')
    await page.getByLabel('Email').focus()
    const boxShadow = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).boxShadow)
    expect(boxShadow).not.toBe('none')
  })
})
