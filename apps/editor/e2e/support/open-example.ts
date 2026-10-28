import { expect, type Page } from '@playwright/test'

/** The header's Examples menu button. */
export function examplesButton(page: Page) {
  return page.getByRole('button', { name: 'Examples', exact: true })
}

/**
 * Opens an example from the header menu with the keyboard only: Enter opens the menu, arrows
 * reach the item and Enter picks it. On a graph with work in it a confirmation follows.
 */
export async function pickExampleByKeyboard(page: Page, title: string): Promise<void> {
  await examplesButton(page).focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Examples' })
  await expect(menu).toBeVisible()
  const items = menu.getByRole('menuitem')
  // Opened from the keyboard, the menu focuses its first item.
  await expect(items.first()).toBeFocused()
  const titles = await items.evaluateAll((elements) =>
    elements.map((element) => {
      const titleId = element.getAttribute('aria-labelledby')
      return titleId === null ? '' : (document.getElementById(titleId)?.textContent ?? '')
    }),
  )
  const index = titles.indexOf(title)
  if (index < 0) throw new Error(`No example titled ${title}`)
  // Radix moves focus a tick after the key, so each press waits for it to land.
  for (let step = 1; step <= index; step += 1) {
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(step)).toBeFocused()
  }
  const item = menu.getByRole('menuitem', { name: title, exact: true })
  await expect(item).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(menu).toBeHidden()
}
