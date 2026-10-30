// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { PAPER_GRAIN_FILE, PAPER_GRAIN_SIZE, encodeGrayPng, paperGrainPixels } from './paper-grain'
import { readGrayPng } from './read-gray-png'

/** The brief's ceiling for a bundled template texture. */
const MAX_SIDE = 1024

describe('the paper grain texture', () => {
  it('is the same image on every run', () => {
    expect(paperGrainPixels()).toEqual(paperGrainPixels())
  })

  it('is committed as the generator draws it', () => {
    const committed = readGrayPng(readFileSync(PAPER_GRAIN_FILE))

    expect(committed.width).toBe(PAPER_GRAIN_SIZE)
    expect(committed.height).toBe(PAPER_GRAIN_SIZE)
    expect(committed.bitDepth).toBe(8)
    expect(committed.colorType).toBe(0)
    expect(committed.pixels).toEqual(paperGrainPixels())
    expect(PAPER_GRAIN_SIZE).toBeLessThanOrEqual(MAX_SIDE)
  })

  it('round-trips through the encoder', () => {
    const pixels = Uint8Array.from({ length: 16 }, (_, index) => index * 16)

    expect(readGrayPng(encodeGrayPng(4, pixels)).pixels).toEqual(pixels)
  })

  it('has visible grain: a spread of levels around a light grey', () => {
    const pixels = paperGrainPixels()
    const mean = pixels.reduce((sum, level) => sum + level, 0) / pixels.length
    const variance = pixels.reduce((sum, level) => sum + (level - mean) ** 2, 0) / pixels.length

    expect(mean).toBeGreaterThan(170)
    expect(mean).toBeLessThan(230)
    expect(Math.sqrt(variance)).toBeGreaterThan(10)
  })
})
