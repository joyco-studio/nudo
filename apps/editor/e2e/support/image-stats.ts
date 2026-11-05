import type { Page } from '@playwright/test'

export interface ImageStats {
  readonly width: number
  readonly height: number
  /** How much the brightness varies across the image (0 to 255); about 0 for a blank image. */
  readonly lumaStdDev: number
}

/**
 * Decodes a base64 image in the page (which already has a decoder, so the specs need no image
 * library) and measures how much its brightness varies: a blank capture has no variance.
 */
export function imageStats(page: Page, base64: string): Promise<ImageStats> {
  return page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes]))
    const surface = document.createElement('canvas')
    surface.width = bitmap.width
    surface.height = bitmap.height
    const context = surface.getContext('2d')
    if (context === null) throw new Error('2D canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    const count = pixels.length / 4
    let sum = 0
    let sumOfSquares = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const luma =
        0.2126 * (pixels[index] ?? 0) +
        0.7152 * (pixels[index + 1] ?? 0) +
        0.0722 * (pixels[index + 2] ?? 0)
      sum += luma
      sumOfSquares += luma * luma
    }
    const mean = sum / count
    return {
      width: bitmap.width,
      height: bitmap.height,
      lumaStdDev: Math.sqrt(Math.max(0, sumOfSquares / count - mean * mean)),
    }
  }, base64)
}
