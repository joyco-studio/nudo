import { expect, test, type Locator, type Page } from '@playwright/test'

import { luminanceSpread } from './support/luminance-spread'
import { pickExampleByKeyboard, templatesBrowser, templatesButton } from './support/open-example'
import { readStoredNodes } from './support/read-autosave'

interface IllustrationTemplate {
  readonly id: string
  readonly title: string
  readonly spanishTitle: string
  /** One of its comment frames: the group id it frames, and its title. */
  readonly frame: { readonly group: string; readonly title: string }
  readonly shape: string
  /** The Sample Texture 2D nodes its bundled images fill; none when nodes draw every pattern. */
  readonly textureNodes: readonly string[]
}

const TEMPLATES: readonly IllustrationTemplate[] = [
  {
    id: 'lines',
    title: 'Lines',
    spanishTitle: 'Líneas',
    frame: { group: 'lines', title: 'Lines' },
    shape: 'Knot',
    textureNodes: [],
  },
  {
    id: 'scribble',
    title: 'Scribble',
    spanishTitle: 'Garabato',
    frame: { group: 'pressure', title: 'Pen pressure' },
    shape: 'Suzanne',
    textureNodes: [],
  },
  {
    id: 'patch',
    title: 'Patch',
    spanishTitle: 'Parches',
    frame: { group: 'directions', title: 'A direction per patch' },
    shape: 'Sphere',
    textureNodes: [],
  },
  {
    id: 'lava-flow',
    title: 'Lava flow',
    spanishTitle: 'Río de lava',
    frame: { group: 'glow', title: 'Blackbody glow' },
    shape: 'Torus',
    textureNodes: [],
  },
  {
    id: 'brush-toon',
    title: 'Brush toon',
    spanishTitle: 'Toon pincel',
    frame: { group: 'palette', title: 'Palette' },
    shape: 'Sphere',
    textureNodes: ['brush', 'mask'],
  },
]

const PALETTE_CHORD = 'ControlOrMeta+k'
/** A shader compile in software WebGL can take a while. */
const PREVIEW_TIMEOUT_MS = 60_000
/**
 * Ink over paper, glowing seams over dark crust, or five colors brushed over a dark backdrop: the
 * luminance spreads far past a flat mesh's.
 */
const MIN_PICTURE_SPREAD = 20

function mainPreview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

const SHA256_HEX = /^[0-9a-f]{64}$/

/** The node types of the autosaved graph. */
async function storedNodeTypes(page: Page): Promise<readonly string[]> {
  return (await readStoredNodes(page)).map((node) => String(node.type))
}

/** The asset id the autosaved graph stores in a node's texture slot, or null. */
async function storedSlotAssetId(page: Page, nodeId: string): Promise<string | null> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  const value = node?.inputValues.texture
  if (typeof value !== 'object' || value === null || !('assetId' in value)) return null
  return typeof value.assetId === 'string' ? value.assetId : null
}

test.describe('illustration templates', () => {
  for (const template of TEMPLATES) {
    const drawnFrom =
      template.textureNodes.length === 0 ? 'nodes alone' : 'nodes and its bundled images'
    test(`${template.title} opens with the keyboard alone, its picture drawn from ${drawnFrom}`, async ({
      page,
    }) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.goto('/')
      await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()

      await pickExampleByKeyboard(page, template.title)

      await expect(templatesBrowser(page)).toBeHidden()
      await expect(templatesButton(page)).toBeFocused()
      await expect(
        page.locator(`.react-flow__node-comment[data-id="frame-${template.frame.group}"]`),
      ).toHaveAttribute('aria-label', template.frame.title)
      await expect(page.locator('[data-error="true"]')).toHaveCount(0)
      await expect(
        mainPreview(page).getByRole('radio', { name: template.shape, exact: true }),
      ).toBeChecked()

      await expect.poll(async () => (await storedNodeTypes(page)).length).toBeGreaterThan(1)
      if (template.textureNodes.length === 0) {
        // Every pattern is made from nodes: no texture is sampled, none had to be stored.
        expect((await storedNodeTypes(page)).filter((type) => type.startsWith('texture/'))).toEqual(
          [],
        )
      }
      // Each bundled image was stored, and its slot points at it rather than showing Missing.
      for (const nodeId of template.textureNodes) {
        await expect.poll(() => storedSlotAssetId(page, nodeId)).toMatch(SHA256_HEX)
        await expect(
          page.locator(`.react-flow__node[data-id="${nodeId}"]`).getByText('Missing'),
        ).toHaveCount(0)
      }
      const canvas = mainPreview(page).locator('canvas')
      await expect
        .poll(async () => luminanceSpread(page, await canvas.screenshot()), {
          timeout: PREVIEW_TIMEOUT_MS,
        })
        .toBeGreaterThan(MIN_PICTURE_SPREAD)
      expect(pageErrors).toEqual([])
    })
  }

  test('the templates browser previews each of them live', async ({ page }) => {
    test.setTimeout(PREVIEW_TIMEOUT_MS * TEMPLATES.length)
    await page.goto('/')
    await templatesButton(page).click()
    const browser = templatesBrowser(page)
    const preview = browser.locator('[data-template-preview]')

    for (const template of TEMPLATES) {
      await browser.getByRole('option', { name: template.title, exact: true }).click()
      await expect(preview).toHaveAttribute('data-shown-template', template.id, {
        timeout: PREVIEW_TIMEOUT_MS,
      })
      await expect(preview).toHaveAttribute('data-status', 'ready', {
        timeout: PREVIEW_TIMEOUT_MS,
      })
    }
  })

  test('⌘K lists each of them, in Spanish too', async ({ page }) => {
    await page.goto('/')
    const canvas = page.getByRole('main', { name: 'Node canvas' })
    await canvas.focus()
    await page.keyboard.press(PALETTE_CHORD)
    const palette = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
    await page.keyboard.type('template')
    for (const { title } of TEMPLATES) {
      await expect(palette.getByRole('option', { name: `Template: ${title}` })).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    await page
      .getByRole('banner')
      .getByRole('button', { name: /^Language/ })
      .click()
    await page.getByRole('menuitemradio', { name: 'Español' }).click()
    // The closing menu hands focus back to its button: wait for that before moving it on.
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(page.getByRole('banner').getByRole('button', { name: /^Idioma/ })).toBeFocused()
    const lienzo = page.getByRole('main', { name: 'Lienzo de nodos' })
    await lienzo.focus()
    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('plantilla')
    for (const { spanishTitle } of TEMPLATES) {
      await expect(
        palette.getByRole('option', { name: `Plantilla: ${spanishTitle}` }),
      ).toBeVisible()
    }
  })
})
