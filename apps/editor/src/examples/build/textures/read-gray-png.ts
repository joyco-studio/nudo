import { inflateSync } from 'node:zlib'

const SIGNATURE_BYTES = 8
const CHUNK_OVERHEAD_BYTES = 12

export interface GrayImage {
  readonly width: number
  readonly height: number
  readonly bitDepth: number
  readonly colorType: number
  readonly pixels: Uint8Array
}

/**
 * Reads an unfiltered 8-bit PNG back into its pixels: the only kind the texture generators write.
 * For their tests, which check the committed files still hold what the generators draw.
 */
export function readGrayPng(file: Buffer): GrayImage {
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
