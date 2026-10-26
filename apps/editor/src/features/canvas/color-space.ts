export type Rgb = readonly [number, number, number]

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const CHANNEL_MAX = 255
const HEX_RADIX = 16

// sRGB transfer function constants (IEC 61966-2-1).
const SRGB_LINEAR_THRESHOLD = 0.04045
const LINEAR_SRGB_THRESHOLD = 0.0031308
const LINEAR_SLOPE = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_SCALE = 1.055
const GAMMA = 2.4

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

function srgbToLinear(channel: number): number {
  if (channel <= SRGB_LINEAR_THRESHOLD) return channel / LINEAR_SLOPE
  return ((channel + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA
}

function linearToSrgb(channel: number): number {
  if (channel <= LINEAR_SRGB_THRESHOLD) return channel * LINEAR_SLOPE
  return GAMMA_SCALE * channel ** (1 / GAMMA) - GAMMA_OFFSET
}

const decodeChannel = (hexPair: string): number =>
  srgbToLinear(Number.parseInt(hexPair, HEX_RADIX) / CHANNEL_MAX)

const encodeChannel = (linear: number): string =>
  Math.round(clampUnit(linearToSrgb(clampUnit(linear))) * CHANNEL_MAX)
    .toString(HEX_RADIX)
    .padStart(2, '0')

/**
 * `<input type="color">` speaks sRGB hex, while shader colors are linear. Returns null for text
 * that is not a `#rrggbb` color.
 */
export function srgbHexToLinear(hex: string): Rgb | null {
  const match = HEX_COLOR_PATTERN.exec(hex)
  if (match === null) return null
  const [, red = '', green = '', blue = ''] = match
  return [decodeChannel(red), decodeChannel(green), decodeChannel(blue)]
}

/** Display hex for a linear color. Values outside 0..1 (HDR) are clamped. */
export function linearToSrgbHex([red, green, blue]: Rgb): string {
  return `#${encodeChannel(red)}${encodeChannel(green)}${encodeChannel(blue)}`
}
