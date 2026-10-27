export type Rgb = readonly [number, number, number]

const OPAQUE = 255
const CHANNELS = 4

/** RGBA bytes of a `size` × `size` checkerboard, one pixel per cell, starting with `first`. */
export function checkerPixels(size: number, first: Rgb, second: Rgb): Uint8Array {
  const pixels = new Uint8Array(size * size * CHANNELS)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue] = (x + y) % 2 === 0 ? first : second
      pixels.set([red, green, blue, OPAQUE], (y * size + x) * CHANNELS)
    }
  }
  return pixels
}
