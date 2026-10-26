import { componentCount } from '../types-system/widest-type'
import type { Conversion } from '../types-system/conversion'
import type { Swizzle, TslFacade } from '../types/tsl-facade'

const W_COMPONENT_INDEX = 3
const PAD_VALUE = 0
const PAD_VALUE_W = 1

const TRUNCATE_SWIZZLES: Readonly<Partial<Record<Conversion['to'], Swizzle>>> = {
  float: 'x',
  vec2: 'xy',
  vec3: 'xyz',
}

const padComponents = (from: Conversion['from'], to: Conversion['to']): readonly number[] =>
  Array.from({ length: componentCount(to) - componentCount(from) }, (_, offset) =>
    componentCount(from) + offset === W_COMPONENT_INDEX ? PAD_VALUE_W : PAD_VALUE,
  )

/** Applies an implicit vector conversion to an expression, mirroring `convertValue`. */
export function applyConversion<E>(tsl: TslFacade<E>, expression: E, conversion: Conversion): E {
  switch (conversion.kind) {
    case 'splat':
      return tsl.construct(conversion.to, [expression])
    case 'truncate': {
      const swizzle = TRUNCATE_SWIZZLES[conversion.to]
      if (swizzle === undefined) {
        throw new Error(`Cannot truncate ${conversion.from} to ${conversion.to}`)
      }
      return tsl.swizzle(expression, swizzle)
    }
    case 'pad':
      return tsl.construct(conversion.to, [
        expression,
        ...padComponents(conversion.from, conversion.to),
      ])
  }
}
