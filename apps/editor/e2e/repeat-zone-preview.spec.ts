import { expect, test } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { graphDocument, seedAutosave } from './support/seed-graph'
import type { SeedEdge, SeedNode } from './support/seed-graph'

/**
 * Repeat zones rendered by the real preview: each graph draws an unlit material whose color the
 * loop computes, so the sphere's center pixel shows the loop's result. The same loop runs here in
 * linear values, and a control graph draws that color from a Vector 3 node: both go through the
 * preview's color pipeline, so the two pixels must match.
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

/** A Repeat Input `p` and the Repeat Output `r` paired with it. */
const zone = (
  input: string,
  output: string,
  inputValues: SeedNode['inputValues'],
): readonly SeedNode[] => [
  node(input, 'logic/repeat-input', inputValues),
  node(output, 'logic/repeat-output', {}, { repeatInput: input }),
]

/**
 * Three slots at once: A halves and adds 0.1, B adds A as it was at the start of the pass, C adds
 * the pass number. The color is (B / 4, A, C / 10).
 */
function threeSlots(iterations: number): { document: string; expected: readonly number[] } {
  let a = 0.5
  let b = 0
  let c = 0
  for (let index = 0; index < iterations; index += 1) {
    ;[a, b, c] = [a * 0.5 + 0.1, b + a, c + index]
  }
  const document = graphDocument(
    [
      ...zone('p', 'r', { iterations: float(iterations), a: float(0.5) }),
      node('halve', 'math/multiply', { b: float(0.5) }),
      node('shift', 'math/add', { b: float(0.1) }),
      node('sumB', 'math/add'),
      node('sumC', 'math/add'),
      node('quarterB', 'math/multiply', { b: float(0.25) }),
      node('tenthC', 'math/multiply', { b: float(0.1) }),
      node('color', 'vector/combine'),
    ],
    [
      wire(['p', 'a'], ['halve', 'a']),
      wire(['halve', 'out'], ['shift', 'a']),
      wire(['shift', 'out'], ['r', 'a']),
      wire(['p', 'b'], ['sumB', 'a']),
      wire(['p', 'a'], ['sumB', 'b']),
      wire(['sumB', 'out'], ['r', 'b']),
      wire(['p', 'c'], ['sumC', 'a']),
      wire(['p', 'index'], ['sumC', 'b']),
      wire(['sumC', 'out'], ['r', 'c']),
      wire(['r', 'b'], ['quarterB', 'a']),
      wire(['quarterB', 'out'], ['color', 'x']),
      wire(['r', 'a'], ['color', 'y']),
      wire(['r', 'c'], ['tenthC', 'a']),
      wire(['tenthC', 'out'], ['color', 'z']),
      wire(['color', 'vec3'], ['master', 'baseColor']),
    ],
    UNLIT,
  )
  return { document, expected: [b * 0.25, a, c * 0.1] }
}

/** A and B trade places every pass: after an odd count they have swapped. Color (A, B, 0). */
const SWAPPED = graphDocument(
  [
    ...zone('p', 'r', { iterations: float(3), a: float(0.2), b: float(0.8) }),
    node('color', 'vector/combine'),
  ],
  [
    wire(['p', 'b'], ['r', 'a']),
    wire(['p', 'a'], ['r', 'b']),
    wire(['r', 'a'], ['color', 'x']),
    wire(['r', 'b'], ['color', 'y']),
    wire(['color', 'vec3'], ['master', 'baseColor']),
  ],
  UNLIT,
)

/**
 * A zone inside a zone: each of 3 outer passes runs 2 inner passes that add 0.05 to the outer
 * value, so it ends at 0.3. Color (A, 0, 0).
 */
const NESTED = graphDocument(
  [
    ...zone('outer', 'outerEnd', { iterations: float(3) }),
    ...zone('inner', 'innerEnd', { iterations: float(2) }),
    node('step', 'math/add', { b: float(0.05) }),
    node('color', 'vector/combine'),
  ],
  [
    wire(['outer', 'a'], ['inner', 'a']),
    wire(['inner', 'a'], ['step', 'a']),
    wire(['step', 'out'], ['innerEnd', 'a']),
    wire(['innerEnd', 'a'], ['outerEnd', 'a']),
    wire(['outerEnd', 'a'], ['color', 'x']),
    wire(['color', 'vec3'], ['master', 'baseColor']),
  ],
  UNLIT,
)

/** The control: the expected linear color, typed into a Vector 3. */
const flatColor = (linear: readonly number[]): string =>
  graphDocument(
    [node('flat', 'input/vector3', { value: { type: 'vec3', value: linear } })],
    [wire(['flat', 'out'], ['master', 'baseColor'])],
    UNLIT,
  )

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

/** Whether every channel lies within `TOLERANCE` of the other pixel's. */
const isClose = (actual: readonly number[], expected: readonly number[]): boolean =>
  expected.length === 3 &&
  expected.every((channel, index) => Math.abs((actual[index] ?? -1) - channel) <= TOLERANCE)

/** The preview's background (#0F0F0F) before any material is drawn. */
const BACKGROUND = [15, 15, 15]

/** Opens the document in a page of its own, failing the test on any page error there. */
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

/** Polls the page's center pixel until `isDone` accepts it, and returns it. */
async function pollCenterPixel(
  page: Page,
  isDone: (pixel: readonly number[], previous: readonly number[]) => boolean,
  message: () => string,
): Promise<readonly number[]> {
  let previous: readonly number[] = []
  let pixel: readonly number[] = []
  await expect
    .poll(
      async () => {
        previous = pixel
        pixel = await centerPixel(page, await previewCanvas(page).screenshot())
        return isDone(pixel, previous)
      },
      { message: message() },
    )
    .toBe(true)
  return pixel
}

async function expectSameColorAs(
  context: BrowserContext,
  document: string,
  linear: readonly number[],
) {
  const flat = await openDocument(context, flatColor(linear))
  // Settled: off the background, and the same in two readings in a row.
  const control = await pollCenterPixel(
    flat,
    (pixel, previous) => !isClose(pixel, BACKGROUND) && isClose(pixel, previous),
    () => 'the control color should settle',
  )
  await flat.close()

  const looped = await openDocument(context, document)
  await pollCenterPixel(
    looped,
    (pixel) => isClose(pixel, control),
    () => `the loop's color should match the control ${control.join(',')}`,
  )
  await looped.close()
}

test.describe('Repeat zone preview', () => {
  test('carries three slots through four passes, each reading the previous pass', async ({
    context,
  }) => {
    const { document, expected } = threeSlots(4)
    await expectSameColorAs(context, document, expected)
  })

  test('leaves every slot at its starting value after zero passes', async ({ context }) => {
    const { document, expected } = threeSlots(0)
    await expectSameColorAs(context, document, expected)
  })

  test('swaps two slots without one overwriting the other', async ({ context }) => {
    await expectSameColorAs(context, SWAPPED, [0.8, 0.2, 0])
  })

  test('runs a zone inside another zone', async ({ context }) => {
    await expectSameColorAs(context, NESTED, [0.3, 0, 0])
  })
})
