import { expect, type Locator, type Page } from '@playwright/test'

/** The header's Templates button, which opens the templates browser. */
export function templatesButton(page: Page): Locator {
  return page.getByRole('banner').getByRole('button', { name: 'Templates', exact: true })
}

/** The templates browser sheet. */
export function templatesBrowser(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Templates', exact: true })
}

/** The title of each option in the browser's list, in list order. */
export async function templateTitles(page: Page): Promise<readonly string[]> {
  return templatesBrowser(page)
    .getByRole('option')
    .evaluateAll((options) =>
      options.map((option) => {
        const titleId = option.getAttribute('aria-labelledby')
        return titleId === null ? '' : (document.getElementById(titleId)?.textContent ?? '')
      }),
    )
}

/**
 * Moves the browser's selection to the template titled `title` with the arrow keys (Home, then
 * Down), each step waiting for focus to land on the option it selects.
 */
export async function selectTemplateByKeyboard(page: Page, title: string): Promise<void> {
  const options = templatesBrowser(page).getByRole('option')
  const index = (await templateTitles(page)).indexOf(title)
  if (index < 0) throw new Error(`No template titled ${title}`)
  await page.keyboard.press('Home')
  await expect(options.first()).toBeFocused()
  for (let step = 1; step <= index; step += 1) {
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(step)).toBeFocused()
  }
  await expect(options.nth(index)).toHaveAttribute('aria-selected', 'true')
}

/**
 * Opens a template with the keyboard only: Enter on the header button opens the browser (focus
 * lands on the selected template), the arrows reach the template and Enter opens it. On a graph
 * with work in it a confirmation follows; otherwise the browser closes.
 */
export async function pickExampleByKeyboard(page: Page, title: string): Promise<void> {
  await templatesButton(page).focus()
  await page.keyboard.press('Enter')
  const browser = templatesBrowser(page)
  await expect(browser).toBeVisible()
  await expect(browser.getByRole('option', { selected: true })).toBeFocused()
  await selectTemplateByKeyboard(page, title)
  await page.keyboard.press('Enter')
}
