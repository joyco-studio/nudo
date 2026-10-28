import type { Page } from '@playwright/test'

/**
 * The standard deviation of the luminance (0..255) of a PNG screenshot's pixels: near 0 for a
 * flat image, tens for a patterned one.
 */
export async function luminanceSpread(page: Page, screenshot: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const surface = document.createElement('canvas')
    surface.width = bitmap.width
    surface.height = bitmap.height
    const context = surface.getContext('2d')
    if (context === null) throw new Error('2D canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    let sum = 0
    let sumOfSquares = 0
    const count = data.length / 4
    for (let index = 0; index < data.length; index += 4) {
      const luminance =
        0.2126 * (data[index] ?? 0) +
        0.7152 * (data[index + 1] ?? 0) +
        0.0722 * (data[index + 2] ?? 0)
      sum += luminance
      sumOfSquares += luminance * luminance
    }
    const mean = sum / count
    return Math.sqrt(Math.max(0, sumOfSquares / count - mean * mean))
  }, screenshot.toString('base64'))
}

/** The share (0..1) of pixels that differ by more than a few levels between two screenshots. */
export async function changedShare(page: Page, before: Buffer, after: Buffer): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const pixels = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const surface = document.createElement('canvas')
        surface.width = bitmap.width
        surface.height = bitmap.height
        const context = surface.getContext('2d')
        if (context === null) throw new Error('2D canvas unavailable')
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data
      }
      const [a, b] = await Promise.all([pixels(first), pixels(second)])
      const levels = 8
      let changed = 0
      for (let index = 0; index < a.length; index += 4) {
        const delta = Math.abs((a[index + 1] ?? 0) - (b[index + 1] ?? 0))
        if (delta > levels) changed += 1
      }
      return changed / (a.length / 4)
    },
    [before.toString('base64'), after.toString('base64')] as const,
  )
}
