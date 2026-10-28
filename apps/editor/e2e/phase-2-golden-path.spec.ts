import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { addNodeFromHeader, connectByKeyboard, graphNode } from './support/graph-keyboard'
import { compileCount } from './support/pending-work'
import {
  readStoredEdgeCount,
  readStoredNodes,
  readStoredProperties,
  readStoredSchemaVersion,
} from './support/read-autosave'
import { seedAutosaveOnce } from './support/seed-graph'

/** The phase-1 water snippet, saved at schema version 1, as a phase-1 autosave holds it. */
const WATER_GRAPH_V1 = readFileSync(
  new URL('../../../packages/core/src/serialization/fixtures/water-graph-v1.json', import.meta.url),
  'utf8',
)
const RED_SWATCH_PATH = fileURLToPath(new URL('./fixtures/red-swatch.png', import.meta.url))
const SHA256_HEX = /^[0-9a-f]{64}$/
/** The master, the threshold pill, Voronoi, Select, Split and Sample Texture 2D. */
const GOLDEN_NODE_COUNT = 6
const GOLDEN_EDGE_NAMES = [
  'Voronoi F1 to Select A',
  'threshold Out to Select B',
  'Sample Texture 2D RGB to Select When True',
  'Sample Texture 2D RGBA to Split In',
  'Split X to Select When False',
  'Select Out to Master Stack Base Color',
] as const
const PREVIEWED_TITLES = ['Voronoi', 'Select', 'Split', 'Sample Texture 2D'] as const
/** The phase-1 water snippet: 15 nodes besides the master, 15 connections. */
const WATER_NODE_COUNT = 16
const WATER_EDGE_COUNT = 15

function propertiesPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Properties', exact: true })
}

/** A connection by the start of its name: a converting one goes on to say how. */
function edgeGroup(page: Page, name: string): Locator {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return page.getByRole('group', { name: new RegExp(`^${escaped}(\\.|$)`) })
}

function codeRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Generated TSL' })
}

/** Opens the Code drawer the way the shortcuts catalog says (C, focus on the canvas) if it's shut. */
async function showCodePanel(page: Page): Promise<void> {
  if (await codeRegion(page).isVisible()) return
  await page.getByRole('main', { name: 'Node canvas' }).focus()
  await page.keyboard.press('c')
  await expect(codeRegion(page)).toBeVisible()
}

/** The Code drawer shows the module for the golden-path graph: unlit, Voronoi, Select, a texture. */
async function expectGoldenModule(page: Page): Promise<void> {
  await showCodePanel(page)
  const code = codeRegion(page)
  await expect(code).toContainText("from 'three/tsl'")
  await expect(code).toContainText('MeshBasicNodeMaterial')
  await expect(code).toContainText('mx_worley_noise_vec2')
  await expect(code).toContainText('select(')
  await expect(code).toContainText('textures')
  await expect(code).toContainText('threshold')
}

function nodePreview(page: Page, title: string): Locator {
  return page.getByRole('img', { name: `${title} preview`, exact: true })
}

/** Adds a Float property named `name` from the Properties "+" menu, then puts it on the canvas. */
async function addFloatPropertyToCanvas(page: Page, name: string): Promise<void> {
  await propertiesPanel(page).getByRole('button', { name: 'Add property' }).focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Add property' })
  await menu.getByRole('menuitem', { name: 'Float', exact: true }).focus()
  await page.keyboard.press('Enter')
  const nameField = propertiesPanel(page).getByRole('textbox', { name: 'Property name' })
  await expect(nameField).toBeFocused()
  await page.keyboard.type(name)
  await page.keyboard.press('Enter')
  // Enter on the row's handle adds the property to the canvas.
  await page.keyboard.press('Enter')
  await expect(graphNode(page, name)).toBeFocused()
}

/** Everything the golden path built, as the canvas and the saved document show it. */
async function expectGoldenGraph(page: Page): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(GOLDEN_NODE_COUNT)
  for (const name of GOLDEN_EDGE_NAMES) await expect(edgeGroup(page, name)).toBeAttached()
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
  await expect(
    graphNode(page, 'Master Stack').getByRole('combobox', { name: 'Lighting' }),
  ).toHaveText('Unlit')
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  for (const title of PREVIEWED_TITLES) {
    await expect(nodePreview(page, title)).toBeVisible()
    await expect(graphNode(page, title).locator('[data-preview-status]'), title).toHaveAttribute(
      'data-preview-status',
      'ready',
    )
  }
  // The autosave lands shortly after the last edit.
  await expect.poll(() => readStoredEdgeCount(page)).toBe(GOLDEN_EDGE_NAMES.length)
  await expect
    .poll(async () => (await readStoredProperties(page)).map((property) => property.name))
    .toEqual(['threshold'])
  await expect
    .poll(async () => {
      const nodes = await readStoredNodes(page)
      return nodes.find((node) => node.type === 'texture/sample-texture-2d')?.inputValues.texture
    })
    .toEqual({ type: 'texture', assetId: expect.stringMatching(SHA256_HEX) })
}

/** Builds the phase-2 golden path graph with the keyboard (and the file chooser for the image). */
async function buildGoldenGraph(page: Page): Promise<void> {
  await addFloatPropertyToCanvas(page, 'threshold')
  await addNodeFromHeader(page, 'voronoi', 'Voronoi')
  await addNodeFromHeader(page, 'select', 'Select')
  await addNodeFromHeader(page, 'split', 'Split')
  await addNodeFromHeader(page, 'sample texture', 'Sample Texture 2D')
  await graphNode(page, 'Sample Texture 2D')
    .locator('input[type="file"]')
    .setInputFiles(RED_SWATCH_PATH)

  const voronoi = graphNode(page, 'Voronoi')
  await connectByKeyboard(page, voronoi, /^F1, output port/, 'Connect Voronoi › F1', 'select › a')
  await connectByKeyboard(
    page,
    graphNode(page, 'threshold'),
    /^Out, output port/,
    'Connect threshold › Out',
    'select › b',
  )
  const sample = graphNode(page, 'Sample Texture 2D')
  await connectByKeyboard(
    page,
    sample,
    /^RGB, output port/,
    'Connect Sample Texture 2D › RGB',
    'select › when true',
  )
  await connectByKeyboard(
    page,
    sample,
    /^RGBA, output port/,
    'Connect Sample Texture 2D › RGBA',
    'split › in',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Split'),
    /^X, output port/,
    'Connect Split › X',
    'select › when false',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Select'),
    /^Out, output port/,
    'Connect Select › Out',
    'base color',
  )

  const lighting = graphNode(page, 'Master Stack').getByRole('combobox', { name: 'Lighting' })
  await lighting.focus()
  await page.keyboard.press('u')
  await expect(lighting).toHaveText('Unlit')
}

test.describe('phase 2', () => {
  test.setTimeout(120_000)

  test('golden path: a property, a texture, Voronoi, Split and Select, unlit, the code panel and node previews, all intact after reload', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(graphNode(page, 'Master Stack')).toBeVisible()

    await buildGoldenGraph(page)
    await expectGoldenGraph(page)
    await expectGoldenModule(page)

    await page.reload()

    await expectGoldenGraph(page)
    await expectGoldenModule(page)
  })

  test('phase-1 v1 autosave opens migrated', async ({ page }) => {
    await seedAutosaveOnce(page, WATER_GRAPH_V1)
    await page.goto('/')

    await expect(page.locator('.react-flow__node')).toHaveCount(WATER_NODE_COUNT)
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(WATER_EDGE_COUNT)
    await expect(page.locator('[data-error="true"]')).toHaveCount(0)
    await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
    const master = graphNode(page, 'Master Stack')
    await expect(master.getByRole('textbox', { name: 'Opacity', exact: true })).toHaveValue('0.85')
    await expect(page.getByText('No properties yet.')).toBeVisible()

    // The first save after an edit writes the current schema version.
    await master.getByRole('textbox', { name: 'Roughness', exact: true }).fill('0.2')
    await page.keyboard.press('Enter')
    await expect.poll(() => readStoredSchemaVersion(page)).toBe(2)
    expect((await readStoredNodes(page)).length).toBe(WATER_NODE_COUNT)
  })
})
