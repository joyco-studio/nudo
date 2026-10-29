import { linearToSrgb, toByte } from '@/shared/components/color-picker/color-math'
import type { Rgb } from '@/shared/components/color-picker/color-math'

import { colorRampColorAt } from './color-ramp-stops'
import type { ColorRampInterpolation, ColorRampStop } from './color-ramp-stops'

/**
 * How many pieces a blended ramp is drawn in. The shader mixes in linear space and CSS mixes in
 * sRGB, so the bar samples the ramp itself rather than handing CSS the stops.
 */
const BLEND_SAMPLES = 32
const PERCENT = 100

function cssColor(linear: Rgb): string {
  const [red, green, blue] = linearToSrgb(linear).map(toByte)
  return `rgb(${String(red)} ${String(green)} ${String(blue)})`
}

const percent = (position: number): string =>
  `${String(Math.round(Math.min(1, Math.max(0, position)) * PERCENT * PERCENT) / PERCENT)}%`

/** Hard edges at each stop: every color holds from its stop until the next one. */
function constantStops(stops: readonly ColorRampStop[]): readonly string[] {
  return stops.flatMap((stop, index) => {
    const start = index === 0 ? 0 : stop.position
    const end = stops[index + 1]?.position ?? 1
    const color = cssColor(stop.color)
    return [`${color} ${percent(start)}`, `${color} ${percent(end)}`]
  })
}

function blendedStops(
  stops: readonly ColorRampStop[],
  interpolation: ColorRampInterpolation,
): readonly string[] {
  return Array.from({ length: BLEND_SAMPLES + 1 }, (_, sample) => {
    const position = sample / BLEND_SAMPLES
    return `${cssColor(colorRampColorAt(stops, interpolation, position))} ${percent(position)}`
  })
}

/** A CSS gradient, left to right, that shows the ramp as the shader renders it (in sRGB). */
export function colorRampGradientCss(
  stops: readonly ColorRampStop[],
  interpolation: ColorRampInterpolation,
): string {
  const cssStops =
    interpolation === 'constant' ? constantStops(stops) : blendedStops(stops, interpolation)
  return `linear-gradient(to right, ${cssStops.join(', ')})`
}
