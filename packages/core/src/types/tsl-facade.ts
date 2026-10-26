import type { VectorType } from './data-type'

export type BuiltinName =
  | 'time'
  | 'uv'
  | 'normalWorld'
  | 'normalView'
  | 'positionLocal'
  | 'positionWorld'
  | 'positionViewDirection'

export type Swizzle = 'x' | 'xy' | 'xyz'

/** The subset of TSL used by nodes, in functional style: `tsl.mul(a, b)`, not `a.mul(b)`. */
export interface TslFacade<E> {
  add(a: E, b: E): E
  mul(a: E, b: E): E
  sin(a: E): E
  pow(a: E, b: E): E
  oneMinus(a: E): E
  clamp(x: E, low: E, high: E): E
  dot(a: E, b: E): E
  mix(a: E, b: E, t: E): E
  builtin(name: BuiltinName): E
  construct(type: VectorType, parts: readonly (E | number)[]): E
  swizzle(value: E, components: Swizzle): E
}
