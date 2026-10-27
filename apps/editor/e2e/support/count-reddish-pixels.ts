import type { Page } from '@playwright/test'

/** A lit red or orange surface shows pixels whose red channel is clearly above the blue one. */
const REDDISH_MARGIN = 60

/** Counts pixels of a PNG screenshot whose red channel clearly dominates the blue one. */
export async function countReddishPixels(page: Page, screenshot: Buffer): Promise<number> {
  return page.evaluate(
    async ([base64, margin]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const surface = document.createElement('canvas')
      surface.width = bitmap.width
      surface.height = bitmap.height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      let reddish = 0
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0
        const blue = data[index + 2] ?? 0
        if (red > blue + margin) reddish += 1
      }
      return reddish
    },
    [screenshot.toString('base64'), REDDISH_MARGIN] as const,
  )
}
