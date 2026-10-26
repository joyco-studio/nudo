import { expect, test, type Locator, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'nudo-tsl:theme'
const MAX_TAB_PRESSES = 40
const THEMES = ['dark', 'light'] as const

async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press('Tab')
    const isFocused = await target.evaluate((element) => element === document.activeElement)
    if (isFocused) return
  }
  throw new Error('Could not reach the target element with Tab')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readThemeToken(page: Page, name: '--foreground' | '--background'): Promise<string> {
  return page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  )
}

/** The R11 indicator: a 2px foreground outline plus a background-colored halo. */
async function expectFocusIndicator(page: Page, target: Locator): Promise<void> {
  const foreground = await readThemeToken(page, '--foreground')
  const background = await readThemeToken(page, '--background')

  await expect(target).toBeFocused()
  await expect(target).toHaveCSS('outline-style', 'solid')
  await expect(target).toHaveCSS('outline-width', '2px')
  await expect(target).toHaveCSS('outline-color', foreground)
  await expect(target).toHaveCSS('box-shadow', new RegExp(`${escapeRegExp(background)}.*2px`))
}

function shellControls(page: Page) {
  return {
    skipLink: page.getByRole('link', { name: 'Skip to canvas' }),
    addNodeButton: page.getByRole('button', { name: 'Add node', exact: true }),
    themeToggle: page.getByRole('button', { name: 'Dark theme', exact: true }),
    previewToggle: page.getByRole('button', { name: 'Preview panel', exact: true }),
    canvas: page.getByRole('main', { name: 'Node canvas' }),
  }
}

test.describe('default theme', () => {
  // Each test gets a fresh browser context, so localStorage starts empty (default theme).
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shell renders header and preview landmark', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Main preview' })).toBeVisible()
    await expect(shellControls(page).canvas).toBeVisible()
  })

  test('theme toggle works by keyboard', async ({ page }) => {
    const html = page.locator('html')
    const { themeToggle } = shellControls(page)
    await expect(html).toHaveClass(/\bdark\b/)
    await expect(themeToggle).toHaveAttribute('aria-pressed', 'true')

    await tabUntilFocused(page, themeToggle)
    await page.keyboard.press('Enter')
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)
    await expect(themeToggle).toHaveAttribute('aria-pressed', 'false')

    await page.reload()
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)
  })

  test('preview panel collapses with keyboard', async ({ page }) => {
    const { previewToggle } = shellControls(page)
    const bodyId = await previewToggle.getAttribute('aria-controls')
    expect(bodyId).toBeTruthy()
    const body = page.locator(`[id="${String(bodyId)}"]`)
    await expect(previewToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(body).toBeVisible()

    await tabUntilFocused(page, previewToggle)
    await page.keyboard.press('Enter')
    await expect(previewToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(body).toBeHidden()

    await page.keyboard.press('Space')
    await expect(previewToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(body).toBeVisible()
  })

  test('skip link moves focus to the canvas', async ({ page }) => {
    const { skipLink, canvas } = shellControls(page)

    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeInViewport()

    await page.keyboard.press('Enter')
    await expect(canvas).toBeFocused()
  })
})

for (const theme of THEMES) {
  test(`every shell control shows a high-contrast focus indicator (${theme})`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value)
      },
      [THEME_STORAGE_KEY, theme] as const,
    )
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
    const { skipLink, addNodeButton, themeToggle, previewToggle, canvas } = shellControls(page)

    // The canvas (nodes and their fields) sits between the header and the preview panel in the
    // tab order, so each control is reached by tabbing forward until it has focus.
    for (const control of [skipLink, addNodeButton, themeToggle, previewToggle]) {
      await tabUntilFocused(page, control)
      await expectFocusIndicator(page, control)
    }

    await skipLink.focus()
    await page.keyboard.press('Enter')
    await expect(canvas).toBeFocused()
    await expect(canvas).toHaveCSS('outline-style', 'solid')
    await expect(canvas).toHaveCSS('outline-offset', '-4px')
  })
}
