import type { Page } from '@playwright/test'

/** A pixel's channels, in the order a decoded PNG stores them. */
const RED = 0
const GREEN = 1
const BLUE = 2
type Channel = typeof RED | typeof GREEN | typeof BLUE

/** A lit red or orange surface shows pixels whose red channel is clearly above the blue one. */
const REDDISH_MARGIN = 60
/** A green line stands clear of a red or orange surface and of a grey background. */
const GREENISH_MARGIN = 60

interface Tint {
  /** The channel that must stand out. */
  readonly channel: Channel
  /** The channels it must be clearly above. */
  readonly over: readonly Channel[]
  readonly margin: number
}

/**
 * Counts the pixels of a PNG screenshot whose `channel` is more than `margin` above each channel
 * of `over`. Decoded in the page, which already has an image decoder, so the specs need no image
 * library.
 */
async function countTintedPixels(page: Page, screenshot: Buffer, tint: Tint): Promise<number> {
  return page.evaluate(
    async ([base64, { channel, over, margin }]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const surface = document.createElement('canvas')
      surface.width = bitmap.width
      surface.height = bitmap.height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      let tinted = 0
      for (let index = 0; index < data.length; index += 4) {
        const value = data[index + channel] ?? 0
        if (over.every((other) => value > (data[index + other] ?? 0) + margin)) tinted += 1
      }
      return tinted
    },
    [screenshot.toString('base64'), tint] as const,
  )
}

/** Counts pixels of a PNG screenshot whose red channel clearly dominates the blue one. */
export function countReddishPixels(page: Page, screenshot: Buffer): Promise<number> {
  return countTintedPixels(page, screenshot, {
    channel: RED,
    over: [BLUE],
    margin: REDDISH_MARGIN,
  })
}

/** Counts pixels of a PNG screenshot whose green channel clearly tops both the red and the blue. */
export function countGreenishPixels(page: Page, screenshot: Buffer): Promise<number> {
  return countTintedPixels(page, screenshot, {
    channel: GREEN,
    over: [RED, BLUE],
    margin: GREENISH_MARGIN,
  })
}
