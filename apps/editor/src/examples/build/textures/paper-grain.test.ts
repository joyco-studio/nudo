// @vitest-environment node
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { PAPER_GRAIN_FILE, PAPER_GRAIN_SIZE, encodeGrayPng, paperGrainPixels } from './paper-grain'

const SIGNATURE_BYTES = 8
const CHUNK_OVERHEAD_BYTES = 12
/** The brief's ceiling for a bundled template texture. */
const MAX_SIDE = 1024

interface GrayImage {
  readonly width: number
  readonly height: number
  readonly bitDepth: number
  readonly colorType: number
  readonly pixels: Uint8Array
}

/** Reads an unfiltered 8-bit PNG back into its pixels (the only kind `encodeGrayPng` writes). */
function readGrayPng(file: Buffer): GrayImage {
  let offset = SIGNATURE_BYTES
  let header: Buffer | null = null
  const data: Buffer[] = []
  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString('ascii', offset + 4, offset + 8)
    const body = file.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') header = body
    if (type === 'IDAT') data.push(body)
    offset += length + CHUNK_OVERHEAD_BYTES
  }
  if (header === null) throw new Error('No IHDR chunk')
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const scanlines = inflateSync(Buffer.concat(data))
  const pixels = new Uint8Array(width * height)
  for (let row = 0; row < height; row += 1) {
    const start = row * (width + 1)
    if (scanlines[start] !== 0) throw new Error(`Row ${String(row)} is filtered`)
    pixels.set(scanlines.subarray(start + 1, start + 1 + width), row * width)
  }
  return { width, height, bitDepth: header[8] ?? 0, colorType: header[9] ?? 0, pixels }
}

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
