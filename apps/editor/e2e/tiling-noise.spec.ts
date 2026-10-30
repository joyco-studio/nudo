import { expect, test, type Page } from '@playwright/test'

import { graphDocument, seedAutosave } from './support/seed-graph'

/**
 * A tiling Noise or Voronoi repeats every Period: on a plane, read in UV with a period of one UV
 * square, its left edge (u = 0) and right edge (u = 1) show the same values row by row. Without
 * tiling they don't. The pattern is drawn in red over a red floor, so the plane stands out from the
 * grey backdrop whatever the pattern does.
 */

/** A shader compile in software WebGL can take a while. */
const PREVIEW_TIMEOUT_MS = 60_000
/** Pixels in from each edge of the plane, clear of its antialiased border. */
const EDGE_INSET = 3
/** Mean red difference (0..255) between the two edges: a tiling pattern stays well under it. */
const SEAMLESS = 12
/** A pattern that does not tile differs across its edges by far more. */
const SEAMED = 25
/** A Minkowski exponent of 2: round cells, true (not squared) distances. */
const MINKOWSKI_ROUND = 2

type Pattern = 'effects/noise' | 'effects/voronoi'

interface PatternCase {
  readonly type: Pattern
  /** The Voronoi's distance, when not its default. */
  readonly distance?: 'minkowski'
}

const CASES: readonly PatternCase[] = [
  { type: 'effects/noise' },
  { type: 'effects/voronoi' },
  { type: 'effects/voronoi', distance: 'minkowski' },
]

/** Unlit, so the light's falloff across the plane doesn't tell the edges apart. */
function unlit(document: string): string {
  const parsed: unknown = JSON.parse(document)
  if (typeof parsed !== 'object' || parsed === null || !('nodes' in parsed)) return document
  const { nodes } = parsed
  if (typeof nodes !== 'object' || nodes === null || !('master' in nodes)) return document
  const { master } = nodes
  if (typeof master !== 'object' || master === null) return document
  Object.assign(master, { params: { lighting: 'unlit' } })
  return JSON.stringify(parsed)
}

function patternOnPlane({ type, distance }: PatternCase, tile: boolean): string {
  const isNoise = type === 'effects/noise'
  return unlit(
    graphDocument(
      [
        { id: 'uv', type: 'input/uv', position: { x: 0, y: 0 } },
        {
          id: 'pattern',
          type,
          position: { x: 250, y: 0 },
          inputValues: {
            scale: { type: 'float', value: isNoise ? 6 : 5 },
            ...(isNoise
              ? { period: { type: 'vec3', value: [1, 1, 0] } }
              : { period: { type: 'vec2', value: [1, 1] } }),
            // Round cells: a star-shaped default would push most distances past the red range.
            ...(distance === 'minkowski'
              ? { exponent: { type: 'float', value: MINKOWSKI_ROUND } }
              : {}),
          },
          params: isNoise
            ? { tile, octaves: 3, kind: 'simplex' }
            : { tile, ...(distance === undefined ? {} : { distance }) },
        },
        {
          id: 'red',
          type: 'math/remap',
          position: { x: 500, y: 0 },
          inputValues: isNoise
            ? {
                inMin: { type: 'float', value: -0.4 },
                inMax: { type: 'float', value: 0.4 },
                outMin: { type: 'float', value: 0.3 },
              }
            : {
                // True distances spread less than squared ones: stretch them to the same contrast.
                ...(distance === 'minkowski'
                  ? { inMax: { type: 'float', value: 0.7 }, outMin: { type: 'float', value: 0.2 } }
                  : { outMin: { type: 'float', value: 0.3 } }),
              },
        },
        { id: 'color', type: 'vector/combine', position: { x: 750, y: 0 } },
      ],
      [
        { id: 'uv-in', from: ['uv', 'out'], to: ['pattern', isNoise ? 'p' : 'uv'] },
        { id: 'pattern-out', from: ['pattern', isNoise ? 'out' : 'f1'], to: ['red', 'in'] },
        { id: 'red-out', from: ['red', 'out'], to: ['color', 'x'] },
        { id: 'color-out', from: ['color', 'vec3'], to: ['master', 'baseColor'] },
      ],
    ),
  )
}

/** The mean red difference between the plane's left and right edges, row by row. */
async function edgeDifference(page: Page): Promise<number> {
  const canvas = page.getByRole('region', { name: 'Main preview' }).locator('canvas')
  const shot = (await canvas.screenshot()).toString('base64')
  return page.evaluate(
    async ({ base64, inset }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const surface = document.createElement('canvas')
      surface.width = bitmap.width
      surface.height = bitmap.height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, 0, 0)
      const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      const red = (x: number, y: number): number => data[(y * width + x) * 4] ?? 0
      const green = (x: number, y: number): number => data[(y * width + x) * 4 + 1] ?? 0
      const onPlane = (x: number, y: number): boolean => red(x, y) > green(x, y) + 40
      let total = 0
      let rows = 0
      for (let y = 0; y < height; y += 1) {
        let left = -1
        let right = -1
        for (let x = 0; x < width; x += 1) {
          if (!onPlane(x, y)) continue
          if (left < 0) left = x
          right = x
        }
        if (left < 0 || right - left < 4 * inset) continue
        total += Math.abs(red(left + inset, y) - red(right - inset, y))
        rows += 1
      }
      if (rows === 0) return Number.POSITIVE_INFINITY
      return total / rows
    },
    { base64: shot, inset: EDGE_INSET },
  )
}

async function showOnPlane(page: Page, document: string): Promise<void> {
  await seedAutosave(page, document)
  await page.goto('/')
  await page.getByRole('radio', { name: 'Plane', exact: true }).click()
  await expect
    .poll(() => edgeDifference(page), { timeout: PREVIEW_TIMEOUT_MS })
    .not.toBe(Number.POSITIVE_INFINITY)
}

test.describe('tiling patterns', () => {
  for (const pattern of CASES) {
    const name = [pattern.type, pattern.distance].filter(Boolean).join(' ')
    test(`a tiling ${name} meets itself across the UV seam; without Tile it doesn't`, async ({
      page,
    }) => {
      test.setTimeout(PREVIEW_TIMEOUT_MS * 3)
      await showOnPlane(page, patternOnPlane(pattern, true))
      await expect
        .poll(() => edgeDifference(page), { timeout: PREVIEW_TIMEOUT_MS })
        .toBeLessThan(SEAMLESS)

      await showOnPlane(page, patternOnPlane(pattern, false))
      await expect
        .poll(() => edgeDifference(page), { timeout: PREVIEW_TIMEOUT_MS })
        .toBeGreaterThan(SEAMED)
    })
  }
})
