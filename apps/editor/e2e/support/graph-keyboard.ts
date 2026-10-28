import { expect, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './focus-indicators'

/** A node on the canvas by its title (the Properties panel has groups named after properties). */
export function graphNode(page: Page, name: string, index = 0): Locator {
  return page
    .getByRole('main', { name: 'Node canvas' })
    .getByRole('group', { name, exact: true })
    .nth(index)
}

/** Opens the add-node menu from the header button, searches and adds the first match. */
export async function addNodeFromHeader(
  page: Page,
  search: string,
  expectedTitle: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Add node', exact: true }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Add node' })
  await expect(dialog).toBeVisible()
  await page.keyboard.type(search)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('group', { name: expectedTitle, exact: true }).last()).toBeFocused()
}

/** Connects `fromPort` to the one port `query` narrows the list to, using only Tab, Enter and typing. */
export async function connectByKeyboard(
  page: Page,
  fromNode: Locator,
  fromPort: RegExp,
  listName: string,
  query: string,
): Promise<void> {
  await fromNode.focus()
  await tabUntilFocused(page, fromNode.getByRole('button', { name: fromPort }))
  await page.keyboard.press('Enter')
  const list = page.getByRole('dialog', { name: listName })
  await expect(list).toBeVisible()
  await page.keyboard.type(query)
  await expect(list.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(list).toBeHidden()
}
