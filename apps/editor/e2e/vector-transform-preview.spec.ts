import { expect, test } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { graphDocument, seedAutosave } from './support/seed-graph'
import type { SeedEdge, SeedNode } from './support/seed-graph'

/**
 * Vector Transform and the distorted Noise compiled by the real preview. Each transform graph is
 * drawn unlit next to a control graph that reads the same value from three's own builtin (view
 * position, view normal): the matrices are right when the two center pixels match.
 */

/** 8-bit rounding and software WebGL leave the two pixels a few levels apart. */
const TOLERANCE = 4
const UNLIT = { params: { lighting: 'unlit' } }

const float = (value: number) => ({ type: 'float' as const, value })

const node = (
  id: string,
  type: string,
  inputValues: SeedNode['inputValues'] = {},
  params: SeedNode['params'] = {},
): SeedNode => ({ id, type, position: { x: 0, y: 0 }, inputValues, params })

const wire = (from: SeedEdge['from'], to: SeedEdge['to']): SeedEdge => ({
  id: `${from.join('-')}--${to.join('-')}`,
  from,
  to,
})

const transform = (id: string, type: string, from: string, to: string): SeedNode =>
  node(id, 'vector/vector-transform', {}, { type, from, to })

/** Draws `source` as a color, mapped from -1…1 to 0…1 so negative components still show. */
function shown(nodes: readonly SeedNode[], edges: readonly SeedEdge[], source: SeedEdge['from']) {
  return graphDocument(
    [
      ...nodes,
      node('half', 'math/multiply', { b: float(0.5) }),
      node('lift', 'math/add', { b: float(0.5) }),
    ],
    [
      ...edges,
      wire(source, ['half', 'a']),
      wire(['half', 'out'], ['lift', 'a']),
      wire(['lift', 'out'], ['master', 'baseColor']),
    ],
    UNLIT,
  )
}

function previewCanvas(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' }).locator('canvas')
}

/** The RGB at the middle of a PNG screenshot, decoded in the page. */
function centerPixel(page: Page, screenshot: Buffer): Promise<readonly number[]> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const surface = document.createElement('canvas')
    surface.width = bitmap.width
    surface.height = bitmap.height
    const context = surface.getContext('2d')
    if (context === null) throw new Error('2D canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const x = Math.floor(bitmap.width / 2)
    const y = Math.floor(bitmap.height / 2)
    return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
  }, screenshot.toString('base64'))
}

const isClose = (actual: readonly number[], expected: readonly number[]): boolean =>
  expected.length === 3 &&
  expected.every((channel, index) => Math.abs((actual[index] ?? -1) - channel) <= TOLERANCE)

/** The preview's background (#0F0F0F) before any material is drawn. */
const BACKGROUND = [15, 15, 15]

async function openDocument(context: BrowserContext, document: string): Promise<Page> {
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    throw error
  })
  await seedAutosave(page, document)
  await page.goto('/')
  await expect(previewCanvas(page)).toBeVisible()
  return page
}

/** The center pixel once it is off the background and the same in two readings in a row. */
async function settledPixel(context: BrowserContext, document: string): Promise<readonly number[]> {
  const page = await openDocument(context, document)
  let previous: readonly number[] = []
  let pixel: readonly number[] = []
  await expect
    .poll(
      async () => {
        previous = pixel
        pixel = await centerPixel(page, await previewCanvas(page).screenshot())
        return !isClose(pixel, BACKGROUND) && isClose(pixel, previous)
      },
      { message: 'the preview should settle on a material' },
    )
    .toBe(true)
  await page.close()
  return pixel
}

async function expectSamePixel(context: BrowserContext, actual: string, control: string) {
  const expected = await settledPixel(context, control)
  const pixel = await settledPixel(context, actual)
  expect(isClose(pixel, expected), `${pixel.join(',')} should match ${expected.join(',')}`).toBe(
    true,
  )
}

test.describe('Vector Transform preview', () => {
  test('carries an object position into camera space where three puts the view position', async ({
    context,
  }) => {
    await expectSamePixel(
      context,
      shown(
        [
          node('p', 'input/position', {}, { space: 'object' }),
          transform('t', 'point', 'object', 'camera'),
        ],
        [wire(['p', 'out'], ['t', 'in'])],
        ['t', 'out'],
      ),
      shown([node('p', 'input/position', {}, { space: 'view' })], [], ['p', 'out']),
    )
  })

  test('brings a point back to object space through world and camera space', async ({
    context,
  }) => {
    await expectSamePixel(
      context,
      shown(
        [
          node('p', 'input/position', {}, { space: 'object' }),
          transform('toWorld', 'point', 'object', 'world'),
          transform('toCamera', 'point', 'world', 'camera'),
          transform('back', 'point', 'camera', 'object'),
        ],
        [
          wire(['p', 'out'], ['toWorld', 'in']),
          wire(['toWorld', 'out'], ['toCamera', 'in']),
          wire(['toCamera', 'out'], ['back', 'in']),
        ],
        ['back', 'out'],
      ),
      shown([node('p', 'input/position', {}, { space: 'object' })], [], ['p', 'out']),
    )
  })

  test('carries an object normal into camera space where three puts the view normal', async ({
    context,
  }) => {
    await expectSamePixel(
      context,
      shown(
        [
          node('n', 'input/normal', {}, { space: 'object' }),
          transform('t', 'normal', 'object', 'camera'),
        ],
        [wire(['n', 'out'], ['t', 'in'])],
        ['t', 'out'],
      ),
      shown([node('n', 'input/normal', {}, { space: 'view' })], [], ['n', 'out']),
    )
  })
})

/**
 * The plan's acceptance graph, Blender's "fluid inside a marble" node for node: a 12-pass march
 * through distorted, unnormalized Perlin fBM along the view ray in object space.
 */
const MARBLE = graphDocument(
  [
    node('origin', 'input/position', {}, { space: 'object' }),
    node('world', 'input/position', {}, { space: 'world' }),
    node('camera', 'input/camera-position'),
    node('ray', 'math/subtract'),
    node('unitRay', 'vector/normalize'),
    transform('objectRay', 'vector', 'world', 'object'),
    node('march', 'logic/repeat-input', { iterations: float(12) }),
    node('marchEnd', 'logic/repeat-output', {}, { repeatInput: 'march' }),
    node(
      'noise',
      'effects/noise',
      {
        scale: float(2),
        roughness: float(0.425),
        lacunarity: float(2.2),
        distortion: float(2),
      },
      { kind: 'perlin', octaves: 9, normalize: false },
    ),
    node('halfNoise', 'math/multiply', { b: float(0.5) }),
    node('absNoise', 'math/abs'),
    node('stride', 'math/multiply', { b: float(0.19) }),
    node('minStep', 'math/exp', { in: float(-6.28) }),
    node('step', 'math/add'),
    node('advance', 'math/multiply'),
    node('next', 'math/add'),
    node('travelled', 'math/distance'),
    node('tint', 'input/vector3', { value: { type: 'vec3', value: [0.96, 2.56, 6.38] } }),
    node('dim', 'math/exp', { in: float(-4.26) }),
    node('glow', 'math/multiply'),
    node('color', 'math/divide'),
  ],
  [
    wire(['world', 'out'], ['ray', 'a']),
    wire(['camera', 'out'], ['ray', 'b']),
    wire(['ray', 'out'], ['unitRay', 'in']),
    wire(['unitRay', 'out'], ['objectRay', 'in']),
    wire(['origin', 'out'], ['march', 'a']),
    wire(['objectRay', 'out'], ['march', 'b']),
    wire(['march', 'a'], ['noise', 'p']),
    wire(['noise', 'out'], ['halfNoise', 'a']),
    wire(['halfNoise', 'out'], ['absNoise', 'in']),
    wire(['absNoise', 'out'], ['stride', 'a']),
    wire(['stride', 'out'], ['step', 'a']),
    wire(['minStep', 'out'], ['step', 'b']),
    wire(['march', 'b'], ['advance', 'a']),
    wire(['step', 'out'], ['advance', 'b']),
    wire(['march', 'a'], ['next', 'a']),
    wire(['advance', 'out'], ['next', 'b']),
    wire(['next', 'out'], ['marchEnd', 'a']),
    wire(['marchEnd', 'a'], ['travelled', 'a']),
    wire(['origin', 'out'], ['travelled', 'b']),
    wire(['tint', 'out'], ['glow', 'a']),
    wire(['dim', 'out'], ['glow', 'b']),
    wire(['glow', 'out'], ['color', 'a']),
    wire(['travelled', 'out'], ['color', 'b']),
    wire(['color', 'out'], ['master', 'baseColor']),
  ],
  { inputValues: { roughness: float(0) } },
)

/** The project of `E2E_GPU=1` runs, with a real GPU behind the preview. */
const GPU_PROJECT = 'chromium-gpu'

test('renders the marble raymarch with a distorted, unnormalized noise', async ({
  context,
}, testInfo) => {
  // 12 passes of 9 octaves plus distortion lose the software WebGL device: GPU runs only.
  test.skip(testInfo.project.name !== GPU_PROJECT, 'Needs a GPU: run with E2E_GPU=1')
  const [red = 0, green = 0, blue = 0] = await settledPixel(context, MARBLE)

  // The glow is blue: (0.96, 2.56, 6.38) over the distance marched.
  expect(blue).toBeGreaterThan(red)
  expect(blue).toBeGreaterThan(green)
})
