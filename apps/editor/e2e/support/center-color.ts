import type { Page } from '@playwright/test'

/** An average color as 0..255 sRGB channels. */
export type Rgb = readonly [number, number, number]

/** A rectangle of the frame, each edge as a share (0..1) of the width or height from the top left. */
export interface FrameRegion {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** The middle of the frame, where a preview mesh sits: a fifth of each side in from the edges. */
const EDGE_SHARE = 0.2
const CENTER_REGION: FrameRegion = {
  left: EDGE_SHARE,
  top: EDGE_SHARE,
  right: 1 - EDGE_SHARE,
  bottom: 1 - EDGE_SHARE,
}

/** The top left corner, where a preview shows only its background: a fifth of each side. */
const CORNER_REGION: FrameRegion = { left: 0, top: 0, right: EDGE_SHARE, bottom: EDGE_SHARE }

/**
 * The average color of a region of a PNG screenshot. Decoded in the page, which already has an
 * image decoder, so the specs need no image library.
 */
export async function averageColor(
  page: Page,
  screenshot: Buffer,
  region: FrameRegion,
): Promise<Rgb> {
  const [red, green, blue] = await page.evaluate(
    async ([base64, bounds]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const left = Math.floor(bitmap.width * bounds.left)
      const top = Math.floor(bitmap.height * bounds.top)
      const width = Math.max(1, Math.ceil(bitmap.width * bounds.right) - left)
      const height = Math.max(1, Math.ceil(bitmap.height * bounds.bottom) - top)
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
    [screenshot.toString('base64'), region] as const,
  )
  return [red ?? 0, green ?? 0, blue ?? 0]
}

/** The average color of the middle of a PNG screenshot. */
export function centerColor(page: Page, screenshot: Buffer): Promise<Rgb> {
  return averageColor(page, screenshot, CENTER_REGION)
}

/** The average color of the top left corner of a PNG screenshot. */
export function cornerColor(page: Page, screenshot: Buffer): Promise<Rgb> {
  return averageColor(page, screenshot, CORNER_REGION)
}

/** Euclidean distance between two colors, in 0..255 channel units. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
