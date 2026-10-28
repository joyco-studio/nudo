import { expect, test, type Page } from '@playwright/test'

import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'

const THEME_STORAGE_KEY = 'nudo-tsl:theme'
const THEMES = ['dark', 'light'] as const

function shellControls(page: Page) {
  return {
    skipLink: page.getByRole('link', { name: 'Skip to canvas' }),
    addNodeButton: page.getByRole('button', { name: 'Add node', exact: true }),
    themeToggle: page.getByRole('button', { name: 'Dark theme', exact: true }),
    previewToggle: page.getByRole('button', { name: 'Preview panel', exact: true }),
    canvas: page.getByRole('main', { name: 'Node canvas' }),
  }
}

/**
 * Reads a color right after the toggle click and React's synchronous re-render (one microtask), so
 * no frame has run yet: a fading theme would still report the old color here.
 */
async function backgroundRightAfterToggle(
  page: Page,
): Promise<{ color: string; duration: string }> {
  return page.evaluate(async () => {
    const toggle = document.querySelector('button[aria-label="Dark theme"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('Theme toggle not found')
    toggle.click()
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })
    const style = getComputedStyle(toggle)
    return { color: style.backgroundColor, duration: style.transitionDuration }
  })
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

  test('switching theme is instant, with no color transition', async ({ page }) => {
    const { themeToggle } = shellControls(page)
    const darkColor = await themeToggle.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )

    const immediate = await backgroundRightAfterToggle(page)
    await expect(page.locator('html')).toHaveClass(/\blight\b/)
    expect(immediate.color).not.toBe(darkColor)
    expect(immediate.duration).toBe('0s')
    // After that frame the color stays put (nothing was animating) and transitions come back.
    await expect(themeToggle).toHaveCSS('background-color', immediate.color)
    await expect(themeToggle).not.toHaveCSS('transition-duration', '0s')
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
    // On a cold, loaded dev server the shell can still be mounting: a Tab sent then lands nowhere.
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()

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
      await expectFocusRing(page, control)
    }

    await skipLink.focus()
    await page.keyboard.press('Enter')
    await expect(canvas).toBeFocused()
    // A full-bleed region gets a quiet 1px inset line from the keyboard, never the big ring.
    await expect(canvas).toHaveCSS('outline-style', 'none')
    await expect(canvas).toHaveCSS('box-shadow', /inset/)
  })
}
