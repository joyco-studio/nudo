import type { VectorType } from './data-type'

export type BuiltinName =
  | 'time'
  | 'uv'
  | 'normalWorld'
  | 'normalView'
  | 'positionLocal'
  | 'positionWorld'
  | 'positionViewDirection'
  | 'positionView'
  | 'screenUV'
  | 'cameraPosition'

export type Swizzle = 'x' | 'y' | 'z' | 'w' | 'xy' | 'xyz'

export type CompareOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

export type NoiseKind = 'perlin' | 'simplex'

export type ColorSpaceDirection = 'srgb-to-linear' | 'linear-to-srgb'

/** The subset of TSL used by nodes, in functional style: `tsl.mul(a, b)`, not `a.mul(b)`. */
export interface TslFacade<E> {
  add(a: E, b: E): E
  sub(a: E, b: E): E
  mul(a: E, b: E): E
  div(a: E, b: E): E
  sin(a: E): E
  cos(a: E): E
  abs(a: E): E
  fract(a: E): E
  floor(a: E): E
  min(a: E, b: E): E
  max(a: E, b: E): E
  exp(a: E): E
  pow(a: E, b: E): E
  oneMinus(a: E): E
  clamp(x: E, low: E, high: E): E
  dot(a: E, b: E): E
  length(a: E): E
  normalize(a: E): E
  distance(a: E, b: E): E
  mix(a: E, b: E, t: E): E
  step(edge: E, x: E): E
  smoothstep(edge0: E, edge1: E, x: E): E
  fwidth(x: E): E
  remap(x: E, inLow: E, inHigh: E, outLow: E, outHigh: E): E
  /** `whenTrue` if `a <op> b`, else `whenFalse`. */
  select(op: CompareOp, a: E, b: E, whenTrue: E, whenFalse: E): E
  /** Scalar noise: float. */
  noise(kind: NoiseKind, p: E): E
  /** Cellular noise: vec2 holding the nearest (F1) and second-nearest (F2) feature distances. */
  voronoi(p: E, jitter: E): E
  /** Checkerboard pattern: float. */
  checker(uv: E): E
  /** Samples a texture: vec4. A `null` level samples with automatic mip selection. */
  textureSample(texture: E, uv: E, level: E | null): E
  colorSpace(direction: ColorSpaceDirection, color: E): E
  builtin(name: BuiltinName): E
  construct(type: VectorType, parts: readonly (E | number)[]): E
  swizzle(value: E, components: Swizzle): E
}
