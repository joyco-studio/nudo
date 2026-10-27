import { fromByte, srgbToHex } from '@/shared/components/color-picker/color-math'

/**
 * Converts any CSS color the browser understands (the theme tokens are `oklch()`) to `#RRGGBB`,
 * the format the color picker reads and shows. Returns null when no 2D canvas is available.
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
  return srgbToHex([fromByte(red), fromByte(green), fromByte(blue)])
}
