import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectFocusRing, expectQuietFieldFocus } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import {
  COLOR_TO_BASE_COLOR,
  TIME_AND_SINE,
  graphDocument,
  seedAutosave,
} from './support/seed-graph'

/** Ctrl+K on Windows and Linux, ⌘K on a Mac. */
const PALETTE_CHORD = 'ControlOrMeta+k'

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function flowNode(page: Page, id: string): Locator {
  return page.locator(`.react-flow__node[data-id="${id}"]`)
}

function palette(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Command palette' })
  return {
    dialog,
    search: dialog.getByRole('combobox'),
    searchGroup: dialog.locator('[data-slot="input-group"]'),
    group: (name: string) => dialog.getByRole('group', { name }),
  }
}

function layoutRadio(page: Page, name: 'Docked' | 'Split' | 'Full'): Locator {
  return page.getByRole('radiogroup', { name: 'Preview layout' }).getByRole('radio', { name })
}

async function openCanvas(page: Page, document: string): Promise<void> {
  await seedAutosave(page, document)
  await page.goto('/')
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}

/** A Sine node far from the master, outside the first fitted view. */
const FAR_SINE = graphDocument(
  [{ id: 'far', type: 'math/sin', position: { x: 5000, y: 5000 } }],
  [],
)

/** USER rule: the same padding on all four sides. */
async function expectEqualPadding(target: Locator): Promise<void> {
  const padding = await target.evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
  })
  expect(new Set(padding).size, padding.join(' ')).toBe(1)
}

/** Running animations on the palette and its overlay right after it opens. */
async function paletteAnimationCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const content = document.querySelector('[data-command-palette]')
    const overlay = content?.previousElementSibling ?? null
    return [content, overlay].reduce(
      (count, element) => count + (element?.getAnimations().length ?? 0),
      0,
    )
  })
}

test.describe('command palette', () => {
  test('⌘K opens palette; typing "split" switches layout', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    const time = graphNode(page, 'Time')
    await time.focus()

    await page.keyboard.press(PALETTE_CHORD)

    const { dialog, search, searchGroup } = palette(page)
    await expect(dialog).toBeVisible()
    // A keyboard surface: it opens at once, with nothing animating in.
    expect(await paletteAnimationCount(page)).toBe(0)
    await expectQuietFieldFocus(page, search, searchGroup)
    await page.keyboard.type('split')
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByRole('option').first()).toContainText('Preview layout: Split')
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    await expect(layoutRadio(page, 'Split')).toBeChecked()
    // Focus goes back to where the person was.
    await expect(time).toBeFocused()
  })

  test('opens from a text field; Escape closes it and returns focus to the field', async ({
    page,
  }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', { name: 'Roughness' })
    await roughness.focus()

    await page.keyboard.press(PALETTE_CHORD)
    const { dialog } = palette(page)
    await expect(dialog).toBeVisible()
    // Panel letters and global keys are typed into the search, not run.
    await page.keyboard.type('bf')
    await expect(palette(page).search).toHaveValue('bf')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(roughness).toBeFocused()
  })

  test('⌘K again closes the palette', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(PALETTE_CHORD)
    await expect(palette(page).dialog).toBeVisible()
    await page.keyboard.press(PALETTE_CHORD)
    await expect(palette(page).dialog).toBeHidden()
  })

  test('jump to node focuses it', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await page.getByRole('main', { name: 'Node canvas' }).focus()

    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('sine')
    const { dialog, group } = palette(page)
    await expect(group('Nodes in graph').getByRole('option', { name: /Sine/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    const sine = flowNode(page, 'sine')
    await expectFocusRing(page, sine)
    await expect(sine).toHaveClass(/selected/)
    // Nothing was added: the jump only moves focus and the view.
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
  })

  test('jump to a node far outside the view brings it into view and focuses it', async ({
    page,
  }) => {
    await openCanvas(page, FAR_SINE)
    const far = flowNode(page, 'far')
    await expect(far).not.toBeInViewport()
    await page.getByRole('main', { name: 'Node canvas' }).focus()

    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('sine')
    const { dialog, group } = palette(page)
    await expect(group('Nodes in graph').getByRole('option', { name: /Sine/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    await expectFocusRing(page, far)
    await expect(far).toBeInViewport()
  })

  test('rows show the pointer cursor and every surface has equal padding', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await page.getByRole('main', { name: 'Node canvas' }).focus()

    await page.keyboard.press(PALETTE_CHORD)
    const { dialog } = palette(page)
    const row = dialog.getByRole('option').first()
    await expect(row).toHaveCSS('cursor', 'pointer')
    await expectEqualPadding(row)
    await expectEqualPadding(dialog.locator('[cmdk-group-heading]').first())
    await expectEqualPadding(dialog.locator('footer'))
    await page.keyboard.type('zzz-no-such-thing')
    await expectEqualPadding(dialog.locator('[cmdk-empty]'))
    await page.keyboard.press('Escape')

    // The add-node menu shares the same rows.
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('Space')
    const addNodeRow = page.getByRole('dialog', { name: 'Add node' }).getByRole('option').first()
    await expect(addNodeRow).toHaveCSS('cursor', 'pointer')
    await expectEqualPadding(addNodeRow)
  })

  test('add node from palette', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    await page.getByRole('main', { name: 'Node canvas' }).focus()

    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('fresnel')
    const { dialog, group } = palette(page)
    await expect(group('Add node').getByRole('option', { name: /Fresnel/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    const fresnel = graphNode(page, 'Fresnel')
    await expect(fresnel).toBeVisible()
    await expectFocusRing(page, fresnel)
    await expect
      .poll(async () =>
        (await readStoredNodes(page)).some((node) => node.type === 'effects/fresnel'),
      )
      .toBe(true)
  })

  test('every row shows its shortcut; the header button opens it and runs a dialog command', async ({
    page,
  }) => {
    await openCanvas(page, TIME_AND_SINE)
    const button = page.getByRole('button', { name: 'Commands' })
    await button.click()

    const { dialog, group } = palette(page)
    await expect(dialog).toBeVisible()
    const paste = group('Actions').getByRole('option', { name: /Paste nodes/ })
    await expect(paste.locator('kbd[data-slot="kbd"]')).toHaveText(['Ctrl/⌘', 'V'])
    // Nothing to undo on a fresh load, so Undo is left out until there is.
    await expect(group('Actions').getByRole('option', { name: /Undo/ })).toHaveCount(0)
    await expect(group('View').getByRole('option', { name: /Properties panel/ })).toContainText('B')

    await dialog.getByRole('option', { name: /Show keyboard shortcuts/ }).click()
    const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(shortcuts).toBeVisible()
    await expect(shortcuts.getByRole('row', { name: /Open the command palette/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(shortcuts).toBeHidden()
    await expect(button).toBeFocused()
  })
})
