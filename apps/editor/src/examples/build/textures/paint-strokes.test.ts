// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  BRUSH_STROKE_FILE,
  BRUSH_STROKE_SIZE,
  STROKE_MASK_FILE,
  STROKE_MASK_SIZE,
  brushStrokePixels,
  encodeGrayPng,
  strokeMaskPixels,
} from './paint-strokes'
import { readGrayPng } from './read-gray-png'

/** The brief's ceiling for a bundled template texture. */
const MAX_SIDE = 1024
const MAX_LEVEL = 255
/** A seam may differ from its neighbours no more than this many times an ordinary pixel step. */
const MAX_SEAM_RATIO = 2

interface PaintedTexture {
  readonly name: string
  readonly file: URL
  readonly size: number
  readonly pixels: () => Uint8Array
}

const TEXTURES: readonly PaintedTexture[] = [
  {
    name: 'brush stroke',
    file: BRUSH_STROKE_FILE,
    size: BRUSH_STROKE_SIZE,
    pixels: brushStrokePixels,
  },
  { name: 'stroke mask', file: STROKE_MASK_FILE, size: STROKE_MASK_SIZE, pixels: strokeMaskPixels },
]

const levelAt = (pixels: Uint8Array, size: number, column: number, row: number): number =>
  pixels[row * size + column] ?? 0

/** The mean level step from column (or row) `from` to the next one, wrapping past the last. */
function meanStep(
  pixels: Uint8Array,
  size: number,
  axis: 'columns' | 'rows',
  from: number,
): number {
  let sum = 0
  for (let index = 0; index < size; index += 1) {
    const next = (from + 1) % size
    sum +=
      axis === 'columns'
        ? Math.abs(levelAt(pixels, size, from, index) - levelAt(pixels, size, next, index))
        : Math.abs(levelAt(pixels, size, index, from) - levelAt(pixels, size, index, next))
  }
  return sum / size
}

function meanInteriorStep(pixels: Uint8Array, size: number, axis: 'columns' | 'rows'): number {
  let sum = 0
  for (let line = 0; line < size - 1; line += 1) sum += meanStep(pixels, size, axis, line)
  return sum / (size - 1)
}

describe.each(TEXTURES.map((texture) => [texture.name, texture] as const))(
  'the %s texture',
  (_, texture) => {
    it('is the same image on every run', () => {
      expect(texture.pixels()).toEqual(texture.pixels())
    })

    it('is committed as the generator paints it', () => {
      const committed = readGrayPng(readFileSync(texture.file))

      expect(committed.width).toBe(texture.size)
      expect(committed.height).toBe(texture.size)
      expect(committed.bitDepth).toBe(8)
      expect(committed.colorType).toBe(0)
      expect(committed.pixels).toEqual(texture.pixels())
      expect(texture.size).toBeLessThanOrEqual(MAX_SIDE)
    })

    it('tiles without a seam: its edges meet like any two neighbouring pixels', () => {
      const pixels = texture.pixels()
      for (const axis of ['columns', 'rows'] as const) {
        const seam = meanStep(pixels, texture.size, axis, texture.size - 1)
        expect(seam, axis).toBeLessThan(
          meanInteriorStep(pixels, texture.size, axis) * MAX_SEAM_RATIO,
        )
      }
    })
  },
)

describe('the brush stroke texture', () => {
  it('spreads its strokes over the whole range of greys', () => {
    const pixels = brushStrokePixels()
    const mean = pixels.reduce((sum, level) => sum + level, 0) / pixels.length
    const variance = pixels.reduce((sum, level) => sum + (level - mean) ** 2, 0) / pixels.length
    const darkShare = pixels.filter((level) => level < 64).length / pixels.length
    const lightShare = pixels.filter((level) => level > 192).length / pixels.length

    expect(mean).toBeGreaterThan(110)
    expect(mean).toBeLessThan(170)
    expect(Math.sqrt(variance)).toBeGreaterThan(50)
    expect(darkShare).toBeGreaterThan(0.05)
    expect(lightShare).toBeGreaterThan(0.15)
  })
})

describe('the stroke mask', () => {
  it('is nearly black or white, mostly white so it only bites the edge here and there', () => {
    const pixels = strokeMaskPixels()
    const extremes = pixels.filter((level) => level < 16 || level > MAX_LEVEL - 16).length
    const whiteShare = pixels.filter((level) => level > MAX_LEVEL / 2).length / pixels.length

    expect(extremes / pixels.length).toBeGreaterThan(0.9)
    expect(whiteShare).toBeGreaterThan(0.6)
    expect(whiteShare).toBeLessThan(0.9)
  })
})

describe('the encoder', () => {
  it('round-trips a small image', () => {
    const pixels = Uint8Array.from({ length: 16 }, (_, index) => index * 16)

    expect(readGrayPng(encodeGrayPng(4, pixels)).pixels).toEqual(pixels)
  })
})
