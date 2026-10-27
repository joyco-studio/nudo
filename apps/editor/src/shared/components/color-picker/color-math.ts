/** Three channels in 0..1: sRGB (what people see and type) or linear (what shaders use). */
export type Rgb = readonly [number, number, number]

/** Hue in degrees (0..360), saturation and value in 0..1. */
export interface Hsv {
  readonly hue: number
  readonly saturation: number
  readonly value: number
}

/** A picker color: the exact sRGB channels plus the HSV the picker's controls edit. */
export interface PickerColor {
  readonly srgb: Rgb
  readonly hsv: Hsv
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const CHANNEL_MAX = 255
const HEX_RADIX = 16
const HEX_DIGITS_PER_CHANNEL = 2

const FULL_TURN_DEGREES = 360
const SECTOR_DEGREES = 60
const GREEN_SECTOR_OFFSET = 2
const BLUE_SECTOR_OFFSET = 4

// sRGB transfer function constants (IEC 61966-2-1).
const SRGB_LINEAR_THRESHOLD = 0.04045
const LINEAR_SRGB_THRESHOLD = 0.0031308
const LINEAR_SLOPE = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_SCALE = 1.055
const GAMMA = 2.4

export const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

const mapRgb = ([red, green, blue]: Rgb, map: (channel: number) => number): Rgb => [
  map(red),
  map(green),
  map(blue),
]

function srgbChannelToLinear(channel: number): number {
  if (channel <= SRGB_LINEAR_THRESHOLD) return channel / LINEAR_SLOPE
  return ((channel + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA
}

function linearChannelToSrgb(channel: number): number {
  if (channel <= LINEAR_SRGB_THRESHOLD) return channel * LINEAR_SLOPE
  return GAMMA_SCALE * channel ** (1 / GAMMA) - GAMMA_OFFSET
}

/** Decodes sRGB channels to linear light (the space the graph stores colors in). */
export const srgbToLinear = (srgb: Rgb): Rgb => mapRgb(srgb, srgbChannelToLinear)

/** Encodes linear channels as sRGB. Values above 1 (HDR) stay above 1. */
export const linearToSrgb = (linear: Rgb): Rgb => mapRgb(linear, linearChannelToSrgb)

/** Reads `#rrggbb`. Returns null for any other text. */
export function hexToSrgb(hex: string): Rgb | null {
  const match = HEX_COLOR_PATTERN.exec(hex)
  if (match === null) return null
  const [, red = '', green = '', blue = ''] = match
  const decode = (pair: string): number => Number.parseInt(pair, HEX_RADIX) / CHANNEL_MAX
  return [decode(red), decode(green), decode(blue)]
}

/** The 0..255 byte of a channel, clamped. */
export const toByte = (channel: number): number => Math.round(clampUnit(channel) * CHANNEL_MAX)

export const fromByte = (byte: number): number => byte / CHANNEL_MAX

/** Writes lowercase `#rrggbb`. Channels outside 0..1 are clamped. */
export function srgbToHex(srgb: Rgb): string {
  const pairs = srgb.map((channel) =>
    toByte(channel).toString(HEX_RADIX).padStart(HEX_DIGITS_PER_CHANNEL, '0'),
  )
  return `#${pairs.join('')}`
}

function hueOf([red, green, blue]: Rgb, max: number, delta: number): number {
  if (delta === 0) return 0
  const sector =
    max === red
      ? (green - blue) / delta
      : max === green
        ? (blue - red) / delta + GREEN_SECTOR_OFFSET
        : (red - green) / delta + BLUE_SECTOR_OFFSET
  const degrees = sector * SECTOR_DEGREES
  return degrees < 0 ? degrees + FULL_TURN_DEGREES : degrees
}

/** HSV of an sRGB color (clamped to 0..1). Grays report hue 0; black reports saturation 0. */
export function srgbToHsv(srgb: Rgb): Hsv {
  const clamped = mapRgb(srgb, clampUnit)
  const max = Math.max(...clamped)
  const delta = max - Math.min(...clamped)
  return {
    hue: hueOf(clamped, max, delta),
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  }
}

/** sRGB of an HSV color. Hue 360 is the same red as hue 0. */
export function hsvToSrgb({ hue, saturation, value }: Hsv): Rgb {
  const channel = (offset: number): number => {
    const position = (offset + hue / SECTOR_DEGREES) % 6
    return value - value * saturation * Math.max(0, Math.min(position, 4 - position, 1))
  }
  return [channel(5), channel(3), channel(1)]
}

/** A picker color from controls that edit HSV (the area and the hue slider). */
export const fromHsv = (hsv: Hsv): PickerColor => ({ hsv, srgb: hsvToSrgb(hsv) })

/**
 * A picker color from exact sRGB (typed hex or channels). Grays have no hue and black has no
 * saturation, so those are kept from the previous HSV: the controls do not jump.
 */
export function withSrgb(previous: Hsv, srgb: Rgb): PickerColor {
  const next = srgbToHsv(srgb)
  const hasHue = next.saturation > 0 && next.value > 0
  return {
    srgb,
    hsv: {
      hue: hasHue ? next.hue : previous.hue,
      saturation: next.value > 0 ? next.saturation : previous.saturation,
      value: next.value,
    },
  }
}
