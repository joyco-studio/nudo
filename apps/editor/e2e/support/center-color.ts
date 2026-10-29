import type { Page } from '@playwright/test'

/** An average color as 0..255 sRGB channels. */
export type Rgb = readonly [number, number, number]

/** The middle of the frame, where a preview mesh sits: a fifth of each side in from the edges. */
const EDGE_SHARE = 0.2

/**
 * The average color of the middle of a PNG screenshot. Decoded in the page, which already has
 * an image decoder, so the specs need no image library.
 */
export async function centerColor(page: Page, screenshot: Buffer): Promise<Rgb> {
  const [red, green, blue] = await page.evaluate(
    async ([base64, edgeShare]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const left = Math.floor(bitmap.width * edgeShare)
      const top = Math.floor(bitmap.height * edgeShare)
      const width = Math.max(1, bitmap.width - 2 * left)
      const height = Math.max(1, bitmap.height - 2 * top)
      const surface = document.createElement('canvas')
      surface.width = width
      surface.height = height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, left, top, width, height, 0, 0, width, height)
      const { data } = context.getImageData(0, 0, width, height)
      const sums = [0, 0, 0]
      for (let index = 0; index < data.length; index += 4) {
        sums[0] = (sums[0] ?? 0) + (data[index] ?? 0)
        sums[1] = (sums[1] ?? 0) + (data[index + 1] ?? 0)
        sums[2] = (sums[2] ?? 0) + (data[index + 2] ?? 0)
      }
      const pixels = data.length / 4
      return sums.map((sum) => sum / pixels)
    },
    [screenshot.toString('base64'), EDGE_SHARE] as const,
  )
  return [red ?? 0, green ?? 0, blue ?? 0]
}

/** Euclidean distance between two colors, in 0..255 channel units. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
