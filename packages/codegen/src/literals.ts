import type { PortValue, VectorPortValue } from '@nudo-tsl/core'
import { compose } from './code-expression'
import type { CodeExpression } from './code-expression'

const SRGB_LINEAR_THRESHOLD = 0.0031308
const SRGB_LINEAR_SLOPE = 12.92
const SRGB_GAMMA_SCALE = 1.055
const SRGB_GAMMA_OFFSET = 0.055
const SRGB_GAMMA = 2.4
const BYTE_MAX = 255
const HEX_RADIX = 16
const HEX_DIGITS_PER_CHANNEL = 2

/** A JS number literal; `-0` reads as `0`, and values a shader cannot hold are refused. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot write ${String(value)} as a shader literal`)
  return Object.is(value, -0) ? '0' : String(value)
}

const components = (value: VectorPortValue): readonly number[] =>
  value.type === 'float' ? [value.value] : value.value

function vectorLiteral(value: VectorPortValue): CodeExpression {
  const args = components(value).map(formatNumber).join(', ')
  return compose(`${value.type}(${args})`, [], { imports: [value.type] })
}

const isDisplayable = (channel: number): boolean =>
  Number.isFinite(channel) && channel >= 0 && channel <= 1

/** Linear light to the sRGB-encoded channel a hex color holds. */
const linearToSrgb = (channel: number): number =>
  channel <= SRGB_LINEAR_THRESHOLD
    ? channel * SRGB_LINEAR_SLOPE
    : SRGB_GAMMA_SCALE * channel ** (1 / SRGB_GAMMA) - SRGB_GAMMA_OFFSET

const toHexDigits = (linearChannel: number): string =>
  Math.round(linearToSrgb(linearChannel) * BYTE_MAX)
    .toString(HEX_RADIX)
    .padStart(HEX_DIGITS_PER_CHANNEL, '0')

/**
 * `color(0x1a2b3c)`: three reads the hex as sRGB and stores it as linear light, which is the
 * space graph colors are kept in. The hex has 8 bits per channel, so it is only used while every
 * channel is displayable; an HDR color keeps its exact `vec3` literal.
 */
function colorLiteral(value: readonly [number, number, number]): CodeExpression {
  if (!value.every(isDisplayable)) return vectorLiteral({ type: 'vec3', value })
  return compose(`color(0x${value.map(toHexDigits).join('')})`, [], { imports: ['color'] })
}

/**
 * The literal of an inline value. A texture has no literal; callers hand it a placeholder.
 */
export function literalOf(value: VectorPortValue, isColor: boolean): CodeExpression {
  return isColor && value.type === 'vec3' ? colorLiteral(value.value) : vectorLiteral(value)
}

export const isVectorValue = (value: PortValue): value is VectorPortValue =>
  value.type !== 'texture'
