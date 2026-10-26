import type { TslFacade } from '@nudo-tsl/core'

const formatParts = (parts: readonly (string | number)[]): string => `[${parts.join(',')}]`

/** A facade whose expressions are the printed calls, e.g. `mix(a,b,t)`. For tests. */
export function createRecordingFacade(): TslFacade<string> {
  return {
    add: (a, b) => `add(${a},${b})`,
    mul: (a, b) => `mul(${a},${b})`,
    sin: (a) => `sin(${a})`,
    pow: (a, b) => `pow(${a},${b})`,
    oneMinus: (a) => `oneMinus(${a})`,
    clamp: (x, low, high) => `clamp(${x},${low},${high})`,
    dot: (a, b) => `dot(${a},${b})`,
    mix: (a, b, t) => `mix(${a},${b},${t})`,
    builtin: (name) => `builtin(${name})`,
    construct: (type, parts) => `construct(${type},${formatParts(parts)})`,
    swizzle: (value, components) => `swizzle(${value},${components})`,
  }
}
