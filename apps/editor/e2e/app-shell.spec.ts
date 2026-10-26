import { expect, test, type Page } from '@playwright/test'

const THEME_TOGGLE_NAME = /switch to (light|dark) theme/i
const MAX_TAB_PRESSES = 20

async function tabUntilFocused(page: Page, name: RegExp): Promise<void> {
  const target = page.getByRole('button', { name })
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press('Tab')
    const isFocused = await target.evaluate((element) => element === document.activeElement)
    if (isFocused) return
  }
  throw new Error(`Could not reach the button ${String(name)} with Tab`)
}

// Each test gets a fresh browser context, so localStorage starts empty (default theme).
test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('shell renders header and preview landmark', async ({ page }) => {
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Main preview' })).toBeVisible()
  await expect(page.getByRole('main', { name: 'Node canvas' })).toBeVisible()
})

test('theme toggle works by keyboard', async ({ page }) => {
  const html = page.locator('html')
  await expect(html).toHaveClass(/\bdark\b/)

  await tabUntilFocused(page, THEME_TOGGLE_NAME)
  await page.keyboard.press('Enter')
  await expect(html).not.toHaveClass(/\bdark\b/)

  await page.reload()
  await expect(html).not.toHaveClass(/\bdark\b/)
})

test('preview panel collapses with keyboard', async ({ page }) => {
  const toggle = page.getByRole('button', { name: /preview/i })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')

  await tabUntilFocused(page, /preview/i)
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
})
