const CHANNEL_HEX_DIGITS = 2
const HEX_RADIX = 16

/**
 * Converts any CSS color the browser understands (the theme tokens are `oklch()`) to `#rrggbb`,
 * the only format `<input type="color">` accepts. Returns null when no 2D canvas is available.
 */
export function cssColorToHex(cssColor: string): string | null {
  const surface = document.createElement('canvas')
  surface.width = 1
  surface.height = 1
  const context = surface.getContext('2d', { willReadFrequently: true })
  if (context === null) return null

  context.fillStyle = cssColor
  context.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data
  const channels = [red, green, blue].map((channel) =>
    channel.toString(HEX_RADIX).padStart(CHANNEL_HEX_DIGITS, '0'),
  )
  return `#${channels.join('')}`
}
