import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

/**
 * Generates `examples/textures/paper-grain.png`: a tileable grey paper grain for templates to
 * multiply over their colors. Procedural and seeded, so the file is the same on every run and owes
 * nothing to a third-party image. Regenerate (Node 22.18+, which runs TypeScript) with:
 *
 *   node apps/editor/src/examples/build/textures/paper-grain.ts
 *
 * Self-contained on purpose (Node can't resolve the editor's extensionless imports); the test next
 * to it checks the committed file still holds exactly these pixels.
 */

/** Side of the square image, in pixels: a small tile, repeated across the surface. */
export const PAPER_GRAIN_SIZE = 256
/** 'nudo' in ASCII. */
const SEED = 0x6e75646f

/** Brightness the grain sits around and how far it swings, in 0..255 levels. */
const MEAN_LEVEL = 200
const CONTRAST_LEVELS = 150
const MAX_LEVEL = 255

/** Cells across the tile for each octave of the cloudy fibre mass, coarse to fine. */
const CLOUD_OCTAVES = [8, 16, 32, 64] as const
/** Short fibres: four times more cells down the tile than across it. */
const FIBRE_CELLS = { x: 32, y: 128 } as const
/** How much each layer weighs: cloudy mass, fibres and per-pixel tooth. */
const WEIGHTS = { cloud: 0.5, fibre: 0.2, tooth: 0.3 } as const

const UINT32_RANGE = 2 ** 32

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

const smooth = (t: number): number => t * t * (3 - 2 * t)

/** Value noise on a `cellsX` × `cellsY` lattice that wraps, so the tile repeats without a seam. */
function createTilingNoise(random: () => number, cellsX: number, cellsY: number) {
  const lattice = Array.from({ length: cellsX * cellsY }, random)
  const at = (x: number, y: number): number => lattice[(y % cellsY) * cellsX + (x % cellsX)] ?? 0
  return (u: number, v: number): number => {
    const x = u * cellsX
    const y = v * cellsY
    const left = Math.floor(x)
    const top = Math.floor(y)
    const tx = smooth(x - left)
    const ty = smooth(y - top)
    const upper = at(left, top) + (at(left + 1, top) - at(left, top)) * tx
    const lower = at(left, top + 1) + (at(left + 1, top + 1) - at(left, top + 1)) * tx
    return upper + (lower - upper) * ty
  }
}

/** The grain's grey levels, row by row from the top: deterministic for the fixed seed. */
export function paperGrainPixels(): Uint8Array {
  const random = createRandom(SEED)
  const clouds = CLOUD_OCTAVES.map((cells) => createTilingNoise(random, cells, cells))
  const fibres = createTilingNoise(random, FIBRE_CELLS.x, FIBRE_CELLS.y)
  const amplitudes = CLOUD_OCTAVES.map((_, octave) => 0.5 ** octave)
  const amplitudeSum = amplitudes.reduce((sum, amplitude) => sum + amplitude, 0)
  const pixels = new Uint8Array(PAPER_GRAIN_SIZE * PAPER_GRAIN_SIZE)
  for (let row = 0; row < PAPER_GRAIN_SIZE; row += 1) {
    for (let column = 0; column < PAPER_GRAIN_SIZE; column += 1) {
      const u = column / PAPER_GRAIN_SIZE
      const v = row / PAPER_GRAIN_SIZE
      const cloud =
        clouds.reduce((sum, noise, octave) => sum + noise(u, v) * (amplitudes[octave] ?? 0), 0) /
        amplitudeSum
      const value = WEIGHTS.cloud * cloud + WEIGHTS.fibre * fibres(u, v) + WEIGHTS.tooth * random()
      const level = Math.round(MEAN_LEVEL + (value - 0.5) * CONTRAST_LEVELS)
      pixels[row * PAPER_GRAIN_SIZE + column] = Math.min(MAX_LEVEL, Math.max(0, level))
    }
  }
  return pixels
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

export const PAPER_GRAIN_FILE = new URL('../../textures/paper-grain.png', import.meta.url)

if (import.meta.main) {
  writeFileSync(PAPER_GRAIN_FILE, encodeGrayPng(PAPER_GRAIN_SIZE, paperGrainPixels()))
}
