import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

/**
 * Generates the Brush toon template's two images from flat-brush strokes painted in code:
 *
 * - `examples/textures/brush-stroke.png`: overlapping strokes in many greys, each with ragged
 *   sides, a blunt start and a tapered end, bristle streaks along it and dry-brush gaps where the
 *   paint runs out. The brush value the template blends over its palette.
 * - `examples/textures/stroke-mask.png`: the same kind of strokes in white over black, nearly
 *   binary; the template bites the silhouette where it is dark.
 *
 * Strokes that cross an edge come back on the other side, so both images tile without a seam.
 * Procedural and seeded: the files are the same on every run and owe nothing to a third-party
 * image. Regenerate from the repo root with:
 *
 *   node apps/editor/src/examples/build/textures/paint-strokes.ts
 *
 * Node 22.18+ runs TypeScript as is; Node 22.6 to 22.17 needs `--experimental-strip-types` first.
 * Self-contained on purpose, like `paper-grain.ts` (Node can't resolve the editor's extensionless
 * imports); the test next to it checks the committed files still hold exactly these pixels.
 */

/** Side of the brush texture, in pixels. */
export const BRUSH_STROKE_SIZE = 512
/** Side of the stroke mask, in pixels: only the silhouette reads it, so it can be coarser. */
export const STROKE_MASK_SIZE = 256

/** 'brsh' and 'mask' in ASCII. */
const BRUSH_SEED = 0x62727368
const MASK_SEED = 0x6d61736b

const MAX_LEVEL = 255
const FULL_TURN = Math.PI * 2
const UINT32_RANGE = 2 ** 32

/** One stroke of a flat brush, in pixels of the tile it is painted on. */
interface Stroke {
  readonly x: number
  readonly y: number
  /** Direction of travel, in radians. */
  readonly angle: number
  readonly length: number
  readonly width: number
  /** How far the stroke's middle sags sideways from a straight line, in pixels. */
  readonly bend: number
  /** The paint's grey, 0..1. */
  readonly tone: number
  /** How much the brush has run dry by the end: 0 never, 1 breaks up into bristle marks. */
  readonly dryness: number
  /** Seeds its own streaks and ragged edges. */
  readonly seed: number
}

/** The size, count and paint ranges of one set of strokes. */
interface StrokeRecipe {
  readonly size: number
  readonly seed: number
  /** Jittered grid cells across the tile, per layer; each cell gets one stroke. */
  readonly cells: number
  readonly layers: number
  readonly length: readonly [min: number, max: number]
  readonly width: readonly [min: number, max: number]
  readonly tone: (random: () => number) => number
  readonly dryness: readonly [min: number, max: number]
  /** Cells of the wrapping noise that turns the strokes, so neighbours run roughly alike. */
  readonly flowCells: number
  /** How far a stroke may stray from the flow, in radians. */
  readonly angleJitter: number
  /** The grey under the first layer. */
  readonly ground: number
}

/** mulberry32: a tiny seeded PRNG, uniform in [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE
  }
}

/** A lattice value in [0, 1) for integer coordinates: the same inputs, the same value. */
function latticeHash(x: number, y: number, seed: number): number {
  let hash = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  return ((hash ^ (hash >>> 16)) >>> 0) / UINT32_RANGE
}

const smooth = (t: number): number => t * t * (3 - 2 * t)
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

function smoothstep(edge0: number, edge1: number, value: number): number {
  return smooth(clamp01((value - edge0) / (edge1 - edge0)))
}

/** Wraps an integer into 0..period-1, negatives included. */
const wrap = (value: number, period: number): number => ((value % period) + period) % period

/**
 * Value noise in [0, 1) on an integer lattice. With a `period` the lattice repeats every `period`
 * cells, so a pattern read over a whole tile meets itself across the edge.
 */
function valueNoise(x: number, y: number, seed: number, period?: number): number {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const at = (column: number, row: number): number =>
    period === undefined
      ? latticeHash(column, row, seed)
      : latticeHash(wrap(column, period), wrap(row, period), seed)
  const tx = smooth(x - left)
  const ty = smooth(y - top)
  const upper = lerp(at(left, top), at(left + 1, top), tx)
  const lower = lerp(at(left, top + 1), at(left + 1, top + 1), tx)
  return lerp(upper, lower, ty)
}

/** Lays the strokes out: a jittered grid per layer, turned by a wrapping flow field. */
function planStrokes(recipe: StrokeRecipe): readonly Stroke[] {
  const random = createRandom(recipe.seed)
  const between = ([min, max]: readonly [number, number]): number => lerp(min, max, random())
  const cellSize = recipe.size / recipe.cells
  const strokes: Stroke[] = []
  for (let layer = 0; layer < recipe.layers; layer += 1) {
    for (let row = 0; row < recipe.cells; row += 1) {
      for (let column = 0; column < recipe.cells; column += 1) {
        const x = (column + random()) * cellSize
        const y = (row + random()) * cellSize
        const flow = valueNoise(
          (x / recipe.size) * recipe.flowCells,
          (y / recipe.size) * recipe.flowCells,
          recipe.seed + layer,
          recipe.flowCells,
        )
        const length = between(recipe.length)
        strokes.push({
          x,
          y,
          angle: flow * FULL_TURN + (random() - 0.5) * 2 * recipe.angleJitter,
          length,
          width: between(recipe.width),
          bend: (random() - 0.5) * length * 0.25,
          tone: recipe.tone(random),
          dryness: between(recipe.dryness),
          seed: Math.floor(random() * UINT32_RANGE),
        })
      }
    }
  }
  // Paint in a shuffled order, so no layer or row sits on top everywhere.
  for (let index = strokes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const current = strokes[index]
    const swapped = strokes[other]
    if (current === undefined || swapped === undefined) continue
    strokes[index] = swapped
    strokes[other] = current
  }
  return strokes
}

/** Pixels over which an edge fades out, so the strokes are antialiased. */
const EDGE_SOFTNESS = 1
/**
 * How a stroke's sides wander in and out: a slow swell and a fine fray, each as pixels along the
 * stroke per bump and a share of its half width.
 */
const RAGS = [
  { wavelength: 23, amount: 0.14 },
  { wavelength: 4, amount: 0.08 },
] as const
/** Pixels across one bristle, and along the stroke before its streak wavers. */
const BRISTLE_WIDTH = 1.7
const BRISTLE_WAVER = 60
/** How far the bristle streaks lighten and darken the paint. */
const STREAK_CONTRAST = 0.38

/**
 * The paint one stroke lays at a point, as a grey and how much it covers, or null where it doesn't
 * reach. `along` and `across` are pixels in the stroke's frame, from its middle.
 */
function strokePaint(
  stroke: Stroke,
  along: number,
  across: number,
): { readonly tone: number; readonly cover: number } | null {
  const halfLength = stroke.length / 2
  const progress = along / stroke.length + 0.5
  if (progress < 0 || progress > 1) return null
  // The stroke curves: its middle sags sideways and its ends stay on the line.
  const bentAcross = across - stroke.bend * (1 - (along / halfLength) ** 2)
  // A flat brush: it lands blunt, then narrows a little as it lifts off.
  const taper = Math.sqrt(smoothstep(0, 0.06, progress)) * (1 - 0.4 * smoothstep(0.6, 1, progress))
  const side = bentAcross < 0 ? 1 : 2
  const rag = RAGS.reduce(
    (sum, { wavelength, amount }, octave) =>
      sum +
      (valueNoise(along / wavelength, side * 17 + octave * 5, stroke.seed) - 0.5) * 2 * amount,
    0,
  )
  const halfWidth = (stroke.width / 2) * taper * (1 + rag)
  const sideCover = clamp01((halfWidth - Math.abs(bentAcross)) / EDGE_SOFTNESS + 0.5)
  const endCover = clamp01((halfLength - along) / EDGE_SOFTNESS + 0.5)
  if (sideCover <= 0 || endCover <= 0) return null
  // Bristles: fine streaks across the stroke that run its length, wavering slowly.
  const fine = valueNoise(bentAcross / BRISTLE_WIDTH, along / BRISTLE_WAVER, stroke.seed + 1)
  const coarse = valueNoise(
    bentAcross / (BRISTLE_WIDTH * 4),
    along / (BRISTLE_WAVER * 2),
    stroke.seed + 2,
  )
  const bristle = 0.6 * fine + 0.4 * coarse
  // Dry brush: the paint thins toward the tail and the outer bristles, leaving gaps between them.
  const edgeShare = Math.abs(bentAcross) / Math.max(halfWidth, EDGE_SOFTNESS)
  const dry = stroke.dryness * (1.1 * smoothstep(0.3, 1, progress) + 0.4 * edgeShare ** 3)
  const dryCover = smoothstep(dry - 0.08, dry + 0.04, bristle)
  return {
    tone: clamp01(stroke.tone + (bristle - 0.5) * 2 * STREAK_CONTRAST * (0.6 + 0.4 * progress)),
    cover: sideCover * endCover * dryCover,
  }
}

/** Paints a stroke onto a square tile of greys, wrapping it around the edges. */
function paintStroke(canvas: Float32Array, size: number, stroke: Stroke): void {
  const cos = Math.cos(stroke.angle)
  const sin = Math.sin(stroke.angle)
  const reach = Math.ceil(stroke.length / 2 + stroke.width + Math.abs(stroke.bend))
  const centerColumn = Math.floor(stroke.x)
  const centerRow = Math.floor(stroke.y)
  for (let row = centerRow - reach; row <= centerRow + reach; row += 1) {
    for (let column = centerColumn - reach; column <= centerColumn + reach; column += 1) {
      const dx = column + 0.5 - stroke.x
      const dy = row + 0.5 - stroke.y
      const paint = strokePaint(stroke, dx * cos + dy * sin, -dx * sin + dy * cos)
      if (paint === null) continue
      const index = wrap(row, size) * size + wrap(column, size)
      canvas[index] = lerp(canvas[index] ?? 0, paint.tone, paint.cover)
    }
  }
}

function paintTile(recipe: StrokeRecipe): Float32Array {
  const canvas = new Float32Array(recipe.size * recipe.size).fill(recipe.ground)
  for (const stroke of planStrokes(recipe)) paintStroke(canvas, recipe.size, stroke)
  return canvas
}

const toLevels = (canvas: Float32Array, curve: (value: number) => number): Uint8Array =>
  Uint8Array.from(canvas, (value) => Math.round(clamp01(curve(value)) * MAX_LEVEL))

const BRUSH_RECIPE: StrokeRecipe = {
  size: BRUSH_STROKE_SIZE,
  seed: BRUSH_SEED,
  cells: 10,
  layers: 4,
  length: [70, 170],
  width: [14, 34],
  // Mostly light and mid greys, with darker strokes in between: every part of the ramp gets paint.
  tone: (random) => 0.12 + 0.88 * random() ** 0.85,
  dryness: [0.15, 0.75],
  flowCells: 3,
  angleJitter: 0.45,
  ground: 0.5,
}

const MASK_RECIPE: StrokeRecipe = {
  size: STROKE_MASK_SIZE,
  seed: MASK_SEED,
  cells: 5,
  layers: 2,
  length: [60, 130],
  width: [16, 34],
  tone: () => 1,
  dryness: [0.3, 0.9],
  flowCells: 2,
  angleJitter: 0.6,
  ground: 0,
}

/** Where the mask's soft paint turns to fully kept or fully bitten. */
const MASK_CUT = { low: 0.35, high: 0.65 } as const

/** The brush texture's grey levels, row by row from the top: deterministic for the fixed seed. */
export function brushStrokePixels(): Uint8Array {
  return toLevels(paintTile(BRUSH_RECIPE), (value) => value)
}

/** The stroke mask's levels, nearly black or white: white keeps the edge, black bites it. */
export function strokeMaskPixels(): Uint8Array {
  return toLevels(paintTile(MASK_RECIPE), (value) => smoothstep(MASK_CUT.low, MASK_CUT.high, value))
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const BIT_DEPTH = 8
const GRAYSCALE = 0
/** Each scanline starts with its filter type; 0 stores the row as it is. */
const NO_FILTER = 0
const CRC_POLYNOMIAL = 0xedb88320

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? CRC_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** An 8-bit greyscale PNG of a square image, its rows stored unfiltered. */
export function encodeGrayPng(size: number, pixels: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([BIT_DEPTH, GRAYSCALE, 0, 0, 0], 8)
  const scanlines = Buffer.alloc(size * (size + 1))
  for (let row = 0; row < size; row += 1) {
    scanlines[row * (size + 1)] = NO_FILTER
    scanlines.set(pixels.subarray(row * size, (row + 1) * size), row * (size + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ])
}

export const BRUSH_STROKE_FILE = new URL('../../textures/brush-stroke.png', import.meta.url)
export const STROKE_MASK_FILE = new URL('../../textures/stroke-mask.png', import.meta.url)

/**
 * Whether Node was asked to run this file, rather than a test importing it. `import.meta.main`
 * would say so, but only Node 24.2+ has it.
 */
const isRunDirectly = process.argv[1] === fileURLToPath(import.meta.url)

if (isRunDirectly) {
  writeFileSync(BRUSH_STROKE_FILE, encodeGrayPng(BRUSH_STROKE_SIZE, brushStrokePixels()))
  writeFileSync(STROKE_MASK_FILE, encodeGrayPng(STROKE_MASK_SIZE, strokeMaskPixels()))
}
