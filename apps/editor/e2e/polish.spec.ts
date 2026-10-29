import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  expectFocusRing,
  expectNoRingShadow,
  isInvisibleShadow,
  tabUntilFocused,
} from './support/focus-indicators'
import { readStoredEdgeCount, readStoredNodes } from './support/read-autosave'
import { TIME_TO_SINE, seedAutosave } from './support/seed-graph'
import { runPastTooltipDelays } from './support/tooltip-delay'

const PANELS_STORAGE_KEY = 'nudo-tsl:panels'
/** Rounding slack, in CSS pixels, when comparing measured boxes. */
const PX_TOLERANCE = 1
/** The tooltip box is 12/16 text in 28px: its sides may be at most this much wider than its top. */
const MAX_TOOLTIP_INSET_RATIO = 1.75
/** A Kbd inside a tooltip sits this far from the top, right and bottom edges. */
const KBD_INSET_PX = 4

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

function layoutRadio(page: Page, name: 'Docked' | 'Split' | 'Full'): Locator {
  return page.getByRole('radiogroup', { name: 'Preview layout' }).getByRole('radio', { name })
}

function contextMenu(page: Page): Locator {
  return page.getByRole('menu')
}

async function storedParam(page: Page, nodeId: string, paramId: string): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return node?.params[paramId]
}

async function storedSplitPercent(page: Page): Promise<unknown> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), PANELS_STORAGE_KEY)
  const stored: unknown = raw === null ? null : JSON.parse(raw)
  return typeof stored === 'object' && stored !== null && 'splitPercent' in stored
    ? stored.splitPercent
    : null
}

/** A point where nothing but the canvas pane is under the pointer. */
async function emptyPanePoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(() => {
    const step = 40
    for (let y = window.innerHeight - step * 4; y > step * 2; y -= step) {
      for (let x = step * 2; x < window.innerWidth / 2; x += step) {
        if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y }
      }
    }
    return null
  })
  if (point === null) throw new Error('No empty canvas in view')
  return point
}

/** Waits out an enter animation, so a box is measured at its final scale. */
async function settleAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return { x: box.x, y: box.y, w: box.width, h: box.height }
}

test.describe('shadcn primitives', () => {
  test('enum params use the shadcn select (combobox role) and work by keyboard', async ({
    page,
  }) => {
    await page.goto('/')
    const master = graphNode(page, 'Master Stack')
    // Selected, so a leaked arrow key would move it.
    await master.locator('header').click()
    const before = await boxOf(master)

    const lighting = master.getByRole('combobox', { name: 'Lighting' })
    await expect(lighting).toHaveAttribute('data-slot', 'select-trigger')
    // Enter on the node steps into its first field, the Lighting select.
    await master.focus()
    await page.keyboard.press('Enter')
    await expectFocusRing(page, lighting)

    await page.keyboard.press('Enter')
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()
    await page.keyboard.press('ArrowDown')
    const unlit = listbox.getByRole('option', { name: 'Unlit' })
    await expect(unlit).toBeFocused()
    // The highlighted option is visibly different from the list behind it.
    const listBackground = await listbox.evaluate((el) => getComputedStyle(el).backgroundColor)
    await expect(unlit).not.toHaveCSS('background-color', listBackground)
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    await expect(listbox).toBeHidden()
    await expect(lighting).toHaveText('Unlit')
    await expect(lighting).toBeFocused()
    // The highlighted row shows by its background alone, with no focus ring around it. The list
    // opens on Unlit, so ArrowDown highlights the option after it.
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    const highlighted = listbox.getByRole('option', { name: 'Physical', exact: true })
    await expect(highlighted).toBeFocused()
    await expect(highlighted).toHaveCSS('outline-style', 'none')
    await expectNoRingShadow(highlighted)
    await expect(highlighted).not.toHaveCSS('background-color', listBackground)
    await page.keyboard.press('Escape')
    // Escape closes an open list and gives focus back to the trigger.
    await expect(listbox).toBeHidden()
    await expect(lighting).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(listbox).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(listbox).toBeHidden()
    await expect(lighting).toBeFocused()
    await expect.poll(async () => storedParam(page, 'master', 'lighting')).toBe('unlit')
    const after = await boxOf(master)
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
  })

  test('only one select is open at a time', async ({ page }) => {
    await page.goto('/')
    // An open select hides the rest of the page from assistive tech, so the triggers are found
    // with hidden elements included.
    const master = page.getByRole('group', {
      name: 'Master Stack',
      exact: true,
      includeHidden: true,
    })
    const listbox = page.getByRole('listbox')
    // Surface first: its list opens downward, clear of the Lighting select above it.
    await master.getByRole('combobox', { name: 'Surface' }).click()
    await expect(listbox).toHaveCount(1)
    const lighting = master.getByRole('combobox', { name: 'Lighting', includeHidden: true })
    await lighting.click()
    await expect(listbox).toHaveCount(1)
    await expect(listbox.getByRole('option', { name: 'Unlit' })).toBeVisible()
    // A select in another panel replaces it too.
    const backdrop = page
      .getByRole('region', { name: 'Main preview', includeHidden: true })
      .getByRole('combobox', { name: 'Backdrop', includeHidden: true })
    await backdrop.click()
    await expect(listbox).toHaveCount(1)
    await expect(listbox.getByRole('option', { name: 'Checker room' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(listbox).toHaveCount(0)
    await expect(backdrop).toBeFocused()
  })

  test('split resize via resizable handle persists', async ({ page }) => {
    await page.goto('/')
    await layoutRadio(page, 'Split').click()
    const handle = page.getByRole('separator', { name: 'Resize preview' })
    await expect(handle).toHaveAttribute('data-slot', 'resizable-handle')
    await expect(handle).toHaveAttribute('aria-valuenow', '50')

    await handle.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(handle).toHaveAttribute('aria-valuenow', '45')
    await expect.poll(async () => storedSplitPercent(page)).toBe(45)

    await page.reload()
    await expect(page.getByRole('separator', { name: 'Resize preview' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    )
  })

  test('the new graph confirmation is an alert dialog with one term for the action', async ({
    page,
  }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await page.getByRole('button', { name: 'New graph', exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Start a new graph?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(dialog.getByRole('button', { name: 'Start new graph' })).toBeVisible()
  })

  test('boolean params are named switches', async ({ page }) => {
    await page.goto('/')
    const twoSided = graphNode(page, 'Master Stack').getByRole('switch', { name: 'Two sided' })
    await expect(twoSided).toHaveAttribute('aria-checked', 'false')
    await twoSided.focus()
    await page.keyboard.press('Space')
    await expect(twoSided).toHaveAttribute('aria-checked', 'true')
    await expect.poll(async () => storedParam(page, 'master', 'twoSided')).toBe(true)
  })

  test('interactive controls show a pointer cursor', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'New graph', exact: true })).toHaveCSS(
      'cursor',
      'pointer',
    )
    await expect(layoutRadio(page, 'Split')).toHaveCSS('cursor', 'pointer')
    await expect(
      graphNode(page, 'Master Stack').getByRole('combobox', { name: 'Lighting' }),
    ).toHaveCSS('cursor', 'pointer')
  })
})

test.describe('context menus', () => {
  test('node context menu duplicates and deletes', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    const sine = graphNode(page, 'Sine')
    await sine.locator('header').click({ button: 'right' })
    const menu = contextMenu(page)
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveText([
      /^Copy/,
      'Duplicate',
      'Hide unconnected ports',
      'Hide preview',
      'Preview mode',
      /^Delete/,
    ])
    await menu.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(menu).toBeHidden()
    await expect(graphNode(page, 'Sine')).toHaveCount(2)

    // Keyboard parity: Shift+F10 on the focused node opens the same menu.
    await graphNode(page, 'Time').focus()
    await page.keyboard.press('Shift+F10')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    // Escape closes it and gives focus back to the node.
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(graphNode(page, 'Time')).toBeFocused()
    await page.keyboard.press('Shift+F10')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(graphNode(page, 'Time')).toHaveCount(0)
    await expect.poll(async () => (await readStoredNodes(page)).length).toBe(3)
  })

  test('node context menu sets the preview mode and collapses ports', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await graphNode(page, 'Sine').focus()
    await page.keyboard.press('ContextMenu')
    const menu = contextMenu(page)
    await menu.getByRole('menuitem', { name: 'Preview mode' }).click()
    await page.getByRole('menuitemradio', { name: '2D' }).click()
    await expect.poll(async () => storedParam(page, 'sine', 'previewMode')).toBe('2d')

    await graphNode(page, 'Sine').locator('header').click({ button: 'right' })
    await menu.getByRole('menuitem', { name: 'Hide unconnected ports' }).click()
    await expect.poll(async () => storedParam(page, 'sine', 'collapsed')).toBe(true)
  })

  test('the master stack menu has no delete or duplicate', async ({ page }) => {
    await page.goto('/')
    await graphNode(page, 'Master Stack').locator('header').click({ button: 'right' })
    const menu = contextMenu(page)
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('edge context menu deletes the connection', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    const edge = page.locator('.react-flow__edge[data-id="time-to-sine"]')
    await edge.focus()
    await page.keyboard.press('Shift+F10')
    const menu = contextMenu(page)
    await menu.getByRole('menuitem', { name: 'Delete connection' }).click()
    await expect.poll(async () => readStoredEdgeCount(page)).toBe(0)
  })

  test('canvas context menu adds a comment and opens the add-node menu', async ({ page }) => {
    await page.goto('/')
    const spot = await emptyPanePoint(page)
    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    const menu = contextMenu(page)
    await expect(menu.getByRole('menuitem')).toHaveText([
      /^Add node…/,
      /^Paste/,
      'Add comment',
      /^Select all/,
      /^Fit view/,
      /^Tidy up graph/,
    ])
    await menu.getByRole('menuitem', { name: 'Add comment' }).click()
    await expect
      .poll(async () => (await readStoredNodes(page)).map((node) => node.type))
      .toContain('utility/comment')

    // The new comment covers the first spot, so look for empty canvas again.
    const nextSpot = await emptyPanePoint(page)
    await page.mouse.click(nextSpot.x, nextSpot.y, { button: 'right' })
    await menu.getByRole('menuitem', { name: /^Add node…/ }).click()
    await expect(page.getByRole('dialog', { name: 'Add node' })).toBeVisible()
  })
})

test.describe('layout polish', () => {
  for (const from of ['Split', 'Full'] as const) {
    test(`docked preview fits after switching layouts (${from} → Docked)`, async ({ page }) => {
      await page.goto('/')
      const viewportCanvas = preview(page).locator('canvas')
      await expect(viewportCanvas).toBeVisible()
      // R3F sizes the canvas after mount: wait for the docked square before measuring it.
      await expect
        .poll(async () => {
          const box = await boxOf(viewportCanvas)
          return Math.abs(box.w - box.h)
        })
        .toBeLessThanOrEqual(PX_TOLERANCE)
      const docked = await boxOf(viewportCanvas)

      await layoutRadio(page, from).click()
      // The bigger layout leaves its height inline on the canvas, which used to prop the square open.
      await expect.poll(async () => (await boxOf(viewportCanvas)).h).toBeGreaterThan(docked.h)
      await layoutRadio(page, 'Docked').click()

      await expect
        .poll(async () => (await boxOf(viewportCanvas)).h)
        .toBeLessThanOrEqual(docked.h + PX_TOLERANCE)
      const fresh = await boxOf(viewportCanvas)
      expect(Math.abs(fresh.w - fresh.h)).toBeLessThanOrEqual(PX_TOLERANCE)
      await expect(preview(page).getByRole('button', { name: 'Reset view' })).toBeInViewport()
    })
  }

  test('tooltip padding is proportional', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Dark theme', exact: true }).hover()
    const plain = page.locator('[data-slot="tooltip-content"]')
    await expect(plain).toBeVisible()
    const padding = await plain.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        top: parseFloat(style.paddingTop),
        right: parseFloat(style.paddingRight),
        left: parseFloat(style.paddingLeft),
      }
    })
    expect(padding.left).toBe(padding.right)
    expect(padding.left / padding.top).toBeLessThanOrEqual(MAX_TOOLTIP_INSET_RATIO)

    // With a shortcut, the Kbd sits evenly inset from the top, right and bottom.
    await page.mouse.move(0, 0)
    await expect(plain).toBeHidden()
    await page.getByRole('button', { name: 'Inspector panel', exact: true }).hover()
    const withKbd = page.locator('[data-slot="tooltip-content"]', { hasText: 'inspector' })
    await expect(withKbd).toBeVisible()
    await settleAnimations(withKbd)
    const tip = await boxOf(withKbd)
    const kbd = await boxOf(withKbd.locator('[data-slot="kbd"]'))
    expect(Math.abs(tip.x + tip.w - (kbd.x + kbd.w) - KBD_INSET_PX)).toBeLessThanOrEqual(1)
    expect(Math.abs(kbd.y - tip.y - KBD_INSET_PX)).toBeLessThanOrEqual(1)
  })

  test('a tooltip never covers the control below it', async ({ page }) => {
    await page.goto('/')
    const inspectorToggle = page.getByRole('button', { name: 'Inspector panel', exact: true })
    const toggleBox = await boxOf(inspectorToggle)
    await page.getByRole('button', { name: 'Dark theme', exact: true }).hover()
    await expect(page.locator('[data-slot="tooltip-content"]')).toBeVisible()
    // Straight down from the theme toggle onto the Inspector toggle, as a person would move.
    await page.mouse.move(toggleBox.x + toggleBox.w / 2, toggleBox.y + toggleBox.h / 2, {
      steps: 4,
    })
    await page.mouse.down()
    await page.mouse.up()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('the header shows the graph breadcrumb and the Properties panel', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('banner')
    await expect(banner.getByRole('navigation', { name: 'Graph' })).toContainText('Untitled graph')
    await expect(page.getByRole('region', { name: 'Properties' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Properties panel', exact: true })).toBeVisible()
  })

  test('hex colors show uppercase', async ({ page }) => {
    await page.goto('/')
    await expect(
      graphNode(page, 'Master Stack').getByRole('button', { name: 'Base Color', exact: true }),
    ).toHaveAccessibleDescription('#E7E7E7')
    await expect(
      preview(page).getByRole('button', { name: 'Background color' }),
    ).toHaveAccessibleDescription(/^#[0-9A-F]{6}$/)
  })

  test('canvas zoom controls are named apart from the preview zoom', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Zoom canvas in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom canvas out' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fit all nodes in view' })).toBeVisible()
    await expect(preview(page).getByRole('button', { name: 'Zoom preview in' })).toBeVisible()
  })

  test('narrow screens start with Properties and Inspector collapsed; the header fits', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Properties panel', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByRole('button', { name: 'Inspector panel', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false')
    // The docked column leaves the canvas zoom controls uncovered.
    const zoomIn = page.getByRole('button', { name: 'Zoom canvas in' })
    const zoomBox = await boxOf(zoomIn)
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
      { x: zoomBox.x + zoomBox.w / 2, y: zoomBox.y + zoomBox.h / 2 },
    )
    expect(hit).toBe('Zoom canvas in')
    // New graph, Templates and Commands live in the More menu on a narrow header.
    for (const name of ['More', 'Add node', 'Dark theme']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
    }
    // The graph name fits whole; nothing in the header is cut off.
    const crumb = page.getByRole('navigation', { name: 'Graph' }).getByText('Untitled graph')
    const { scrollWidth, clientWidth } = await crumb.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})

test.describe('one overlay at a time', () => {
  function hiddenAware(page: Page, name: string): Locator {
    // An open overlay hides the rest of the page from assistive tech.
    return page.getByRole('group', { name, exact: true, includeHidden: true })
  }

  async function focusIsInside(page: Page, selector: string): Promise<boolean> {
    return page.evaluate((within) => document.activeElement?.closest(within) !== null, selector)
  }

  test('opening a select closes an open color picker', async ({ page }) => {
    await page.goto('/')
    const master = graphNode(page, 'Master Stack')
    await master.getByRole('button', { name: 'Base Color', exact: true }).click()
    const picker = page.getByRole('dialog', { name: 'Base Color' })
    await expect(picker).toBeVisible()

    await hiddenAware(page, 'Master Stack')
      .getByRole('combobox', { name: 'Lighting', includeHidden: true })
      .click()
    await expect(page.getByRole('listbox')).toHaveCount(1)
    await expect(picker).toBeHidden()
    expect(await focusIsInside(page, '[role="listbox"]')).toBe(true)
  })

  test('opening a select closes an open context menu', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await graphNode(page, 'Sine').locator('header').click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()

    const lighting = hiddenAware(page, 'Master Stack').getByRole('combobox', {
      name: 'Lighting',
      includeHidden: true,
    })
    await lighting.click()
    await expect(page.getByRole('listbox')).toHaveCount(1)
    await expect(contextMenu(page)).toHaveCount(0)
    expect(await focusIsInside(page, '[role="listbox"]')).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(lighting).toBeFocused()
  })

  test('a right-click inside a node color picker opens no node menu', async ({ page }) => {
    await page.goto('/')
    await graphNode(page, 'Master Stack')
      .getByRole('button', { name: 'Base Color', exact: true })
      .click()
    const picker = page.getByRole('dialog', { name: 'Base Color' })
    await picker.getByRole('slider', { name: 'Hue' }).click({ button: 'right' })
    await expect(contextMenu(page)).toHaveCount(0)
    await expect(picker).toBeVisible()
  })
})

test.describe('equal padding', () => {
  test('tooltip, node header chevron and comment title sit as far from the side as from the top', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Dark theme', exact: true }).hover()
    const tooltip = page.locator('[data-slot="tooltip-content"]')
    await expect(tooltip).toBeVisible()
    const padding = await tooltip.evaluate((element) => {
      const style = getComputedStyle(element)
      return { top: parseFloat(style.paddingTop), left: parseFloat(style.paddingLeft) }
    })
    expect(Math.abs(padding.left - padding.top)).toBeLessThanOrEqual(PX_TOLERANCE)

    const header = graphNode(page, 'Master Stack').locator('header')
    const chevron = header.getByRole('button', { name: 'Unconnected ports' })
    const headerBox = await boxOf(header)
    const chevronBox = await boxOf(chevron)
    const chevronInsetX = chevronBox.x - headerBox.x
    const chevronInsetY = chevronBox.y - headerBox.y
    expect(Math.abs(chevronInsetX - chevronInsetY)).toBeLessThanOrEqual(PX_TOLERANCE)

    const spot = await emptyPanePoint(page)
    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    await contextMenu(page).getByRole('menuitem', { name: 'Add comment' }).click()
    const title = page.getByRole('textbox', { name: 'Comment title' })
    await expect(title).toBeVisible()
    const inset = await title.evaluate((element) => {
      const header = element.closest('header')
      if (header === null) throw new Error('Comment title is outside its header')
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      const headerBox = header.getBoundingClientRect()
      const lineHeight = parseFloat(style.lineHeight)
      const contentHeight = box.height - parseFloat(style.borderTopWidth) * 2
      return {
        x:
          box.left -
          headerBox.left +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.paddingLeft),
        y:
          box.top -
          headerBox.top +
          parseFloat(style.borderTopWidth) +
          (contentHeight - lineHeight) / 2,
        background: style.backgroundColor,
        borderColor: style.borderTopColor,
      }
    })
    expect(Math.abs(inset.x - inset.y)).toBeLessThanOrEqual(PX_TOLERANCE)
    // A quiet inline title: no box of its own while it isn't being edited.
    expect(inset.background).toBe('rgba(0, 0, 0, 0)')
    expect(inset.borderColor).toBe('rgba(0, 0, 0, 0)')
  })
})

test.describe('focus across the app', () => {
  async function ringOnActiveElement(page: Page): Promise<{ outline: string; shadow: string }> {
    return page
      .evaluate(() => {
        const element = document.activeElement
        if (element === null) return { outline: 'none', shadow: 'none' }
        const style = getComputedStyle(element)
        return { outline: style.outlineStyle, shadow: style.boxShadow }
      })
      .then(({ outline, shadow }) => ({
        outline,
        shadow: isInvisibleShadow(shadow) ? 'none' : shadow,
      }))
  }

  test('closing the new-graph dialog with the mouse leaves no ring anywhere', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await page.getByRole('button', { name: 'New graph', exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Start a new graph?' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(await ringOnActiveElement(page)).toEqual({ outline: 'none', shadow: 'none' })
    const canvasMain = page.getByRole('main', { name: 'Node canvas' })
    await expect(canvasMain).toHaveCSS('outline-style', 'none')
  })

  test('a click on the canvas shows no frame', async ({ page }) => {
    await page.goto('/')
    const spot = await emptyPanePoint(page)
    await page.mouse.click(spot.x, spot.y)
    const canvasMain = page.getByRole('main', { name: 'Node canvas' })
    await expect(canvasMain).toHaveCSS('outline-style', 'none')
    await expectNoRingShadow(canvasMain)
    expect((await ringOnActiveElement(page)).outline).toBe('none')
  })

  test('Tab to a control shows the ring; a click on it does not', async ({ page }) => {
    await page.goto('/')
    const newGraph = page.getByRole('button', { name: 'New graph', exact: true })
    await tabUntilFocused(page, newGraph)
    await expectFocusRing(page, newGraph)

    const addNode = page.getByRole('button', { name: 'Add node', exact: true })
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Dark theme', exact: true })).toHaveCSS(
      'outline-style',
      'none',
    )
    await expect(addNode).toHaveCSS('outline-style', 'none')
  })

  test('a select used with the mouse shows no ring; Tab and keyboard use do', async ({ page }) => {
    await page.goto('/')
    const master = graphNode(page, 'Master Stack')
    const lighting = master.getByRole('combobox', { name: 'Lighting' })
    await lighting.click()
    await page.getByRole('option', { name: 'Unlit' }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(lighting).toBeFocused()
    await expect(lighting).toHaveCSS('outline-style', 'none')
    await expectNoRingShadow(lighting)
    expect(await ringOnActiveElement(page)).toEqual({ outline: 'none', shadow: 'none' })

    // Tab from there: the next control wears the ring.
    await page.keyboard.press('Tab')
    await expectFocusRing(page, master.getByRole('combobox', { name: 'Surface' }))

    // Keyboard only: open, close, and the trigger keeps the ring.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expectFocusRing(page, lighting)
  })

  test('an enabled input row keeps the default cursor', async ({ page }) => {
    await page.goto('/')
    const row = graphNode(page, 'Master Stack').locator('[data-port-id="roughness"]')
    await expect(row).not.toHaveAttribute('data-disabled')
    await expect(row).not.toHaveCSS('cursor', 'not-allowed')
  })
})

test.describe('fix round 2', () => {
  test('a tooltip hovered while an overlay was open does not appear after it closes', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/')
    const spot = await emptyPanePoint(page)
    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    await expect(contextMenu(page)).toBeVisible()

    // Hover the Master Stack chevron while the menu is open, then leave it.
    const chevron = page
      .getByRole('group', { name: 'Master Stack', exact: true, includeHidden: true })
      .getByRole('button', { name: 'Unconnected ports', includeHidden: true })
    const box = await boxOf(chevron)
    await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2, { steps: 3 })
    // Long enough on it for its tooltip to have opened, were no overlay open.
    await runPastTooltipDelays(page)
    await page.mouse.move(spot.x, spot.y, { steps: 3 })
    await page.keyboard.press('Escape')
    await expect(contextMenu(page)).toHaveCount(0)

    await runPastTooltipDelays(page)
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
  })

  test('text fields focused with the mouse keep their resting border', async ({ page }) => {
    await page.goto('/')
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', {
      name: 'Roughness',
      exact: true,
    })
    const resting = await roughness.evaluate((el) => getComputedStyle(el).borderTopColor)
    await roughness.click()
    await expect(roughness).toBeFocused()
    // Off the field, so its hover border doesn't count.
    const spot = await emptyPanePoint(page)
    await page.mouse.move(spot.x, spot.y)
    await expect(roughness).toHaveCSS('border-top-color', resting)

    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    await contextMenu(page).getByRole('menuitem', { name: 'Add comment' }).click()
    const title = page.getByRole('textbox', { name: 'Comment title' })
    await title.click()
    await expect(title).toBeFocused()
    await expect(title).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')

    // From the keyboard, the quiet foreground border shows.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(title).toBeFocused()
    await expect(title).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
  })
})
