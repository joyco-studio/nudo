import { expect, type Locator, type Page } from '@playwright/test'

/** Enough to wrap once around the whole page (header, panels, canvas, code drawer) and back. */
const MAX_TAB_PRESSES = 60

export async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
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

export async function readThemeToken(
  page: Page,
  name: '--foreground' | '--background',
): Promise<string> {
  return page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  )
}

/** The R11 ring for non-text controls: a 2px foreground outline plus a background halo. */
export async function expectFocusRing(page: Page, target: Locator): Promise<void> {
  const foreground = await readThemeToken(page, '--foreground')
  const background = await readThemeToken(page, '--background')

  await expect(target).toBeFocused()
  await expect(target).toHaveCSS('outline-style', 'solid')
  await expect(target).toHaveCSS('outline-width', '2px')
  await expect(target).toHaveCSS('outline-color', foreground)
  await expect(target).toHaveCSS('box-shadow', new RegExp(`${escapeRegExp(background)}.*2px`))
}

/**
 * A box-shadow that draws nothing: `none`, or the stack Tailwind leaves on a component whose ring
 * variables were cleared (every layer fully transparent).
 */
export function isInvisibleShadow(shadow: string): boolean {
  if (shadow === 'none') return true
  return shadow.split(/,(?![^(]*\))/).every((layer) => layer.trim().startsWith('rgba(0, 0, 0, 0)'))
}

export async function expectNoRingShadow(target: Locator): Promise<void> {
  await expect
    .poll(async () =>
      isInvisibleShadow(await target.evaluate((el) => getComputedStyle(el).boxShadow)),
    )
    .toBe(true)
}

/**
 * The quiet indicator for text entry: no ring or halo; the field's border (or, inside an input
 * group, the group's border) turns the foreground color. `frame` is the element that owns the
 * border: the field itself, or its input group.
 */
export async function expectQuietFieldFocus(
  page: Page,
  field: Locator,
  frame: Locator = field,
): Promise<void> {
  const foreground = await readThemeToken(page, '--foreground')

  await expect(field).toBeFocused()
  await expect(field).toHaveCSS('outline-style', 'none')
  await expectNoRingShadow(field)
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    await expect(frame).toHaveCSS(`border-${side}-color`, foreground)
  }
}
