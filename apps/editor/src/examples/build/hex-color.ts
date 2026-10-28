import { vec3 } from '@nudo-tsl/core'
import type { PortValue } from '@nudo-tsl/core'

import { hexToSrgb, srgbToLinear } from '@/shared/components/color-picker/color-math'

/** Enough digits that every color reads back as the hex it was written as. */
const LINEAR_DIGITS = 6

const rounded = (value: number): number => Number(value.toFixed(LINEAR_DIGITS))

/**
 * A color written as `#RRGGBB`, stored the way the graph stores colors: linear light. A malformed
 * hex is a mistake in an example, so it throws.
 */
export function hexColor(hex: string): PortValue {
  const srgb = hexToSrgb(hex)
  if (srgb === null) throw new Error(`Not a #RRGGBB color: ${hex}`)
  const [red, green, blue] = srgbToLinear(srgb)
  return vec3(rounded(red), rounded(green), rounded(blue))
}
