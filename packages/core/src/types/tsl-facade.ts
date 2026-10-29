import type { VectorType } from './data-type'

export type BuiltinName =
  | 'time'
  | 'deltaTime'
  | 'uv'
  | 'normalWorld'
  | 'normalView'
  | 'normalLocal'
  | 'positionLocal'
  | 'positionWorld'
  | 'positionViewDirection'
  | 'positionView'
  | 'screenUV'
  | 'cameraPosition'
  /** The object's scale in world space, per axis: vec3. */
  | 'modelScale'

export type Swizzle = 'x' | 'y' | 'z' | 'w' | 'xy' | 'xyz'

export type CompareOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

export type NoiseKind = 'perlin' | 'simplex'

/** How a Voronoi measures the distance from a point to a cell's feature point. */
export type VoronoiMetric = 'euclidean' | 'manhattan' | 'chebyshev'

/**
 * The id three's MaterialX worley noise (`mx_worley_distance`) gives each metric, shared by both
 * TSL backends. 1 compares squared Euclidean distances; `mx_worley_noise_vec2`, which a Euclidean
 * Voronoi has always printed, passes it, so Euclidean F1 and F2 are squared distances.
 */
export const WORLEY_METRIC_IDS: Readonly<Record<VoronoiMetric, number>> = {
  euclidean: 1,
  manhattan: 2,
  chebyshev: 3,
}

/** What a hash returns: one random float, or three decorrelated ones as a vec3. */
export type HashKind = 'float' | 'vec3'

/** The 2D or 3D variant of a cell search. */
export type CellDimensions = 2 | 3

export type ColorSpaceDirection = 'srgb-to-linear' | 'linear-to-srgb'

/** What a Main Light node reads off the scene's shared key light. */
export type MainLightComponent = 'direction' | 'color'

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
  /** The angle of the point (x, y) from the +X axis, in radians from -π to π. */
  atan2(y: E, x: E): E
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
  /**
   * Cellular noise around a vec2 or vec3 point: vec2 holding the nearest (F1) and second-nearest
   * (F2) feature distances under `metric`.
   */
  voronoi(p: E, jitter: E, metric: VoronoiMetric): E
  /** The feature point F1 measures, in the same space as `p`: vec2 or vec3, per `dimensions`. */
  voronoiCell(dimensions: CellDimensions, p: E, jitter: E, metric: VoronoiMetric): E
  /**
   * Cellular noise under the Minkowski distance with `exponent` (float), which MaterialX's worley
   * noise lacks: vec2 holding F1 and F2, as true distances (not squared).
   */
  voronoiMinkowski(dimensions: CellDimensions, p: E, jitter: E, exponent: E): E
  /** The feature point the Minkowski F1 measures, in the space of `p`: vec2 or vec3. */
  voronoiMinkowskiCell(dimensions: CellDimensions, p: E, jitter: E, exponent: E): E
  /** A random float from 0 to 1, constant inside each unit cell of `p`. */
  cellNoise(p: E): E
  /**
   * White noise at a point: each value of `p` (float, vec2 or vec3) maps to its own random value in
   * [0, 1), the same on every frame. A different `seed` (float) gives a different field. Returns a
   * float or, for `'vec3'`, three decorrelated floats.
   */
  hash(kind: HashKind, p: E, seed: E): E
  /** Checkerboard pattern: float. */
  checker(uv: E): E
  /** Samples a texture: vec4. A `null` level samples with automatic mip selection. */
  textureSample(texture: E, uv: E, level: E | null): E
  colorSpace(direction: ColorSpaceDirection, color: E): E
  /** The color rendered behind the surface at the given screen UV: vec3. */
  sceneColor(uv: E): E
  /** 0 at the surface and 1 once the scene behind it is `distance` further away: float. */
  sceneDepthFade(distance: E): E
  /** View-space normal from the screen-space derivatives of a height: vec3. */
  normalFromHeight(height: E, strength: E): E
  /** The shared key light: world-space direction toward it, or color × intensity: vec3. */
  mainLight(component: MainLightComponent): E
  builtin(name: BuiltinName): E
  construct(type: VectorType, parts: readonly (E | number)[]): E
  swizzle(value: E, components: Swizzle): E
}
