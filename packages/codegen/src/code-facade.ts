import { VORONOI_DISTANCE_IDS, WORLEY_METRIC_IDS } from '@nudo-tsl/core'
import type {
  CellDimensions,
  ColorSpaceDirection,
  CompareOp,
  HashKind,
  MainLightComponent,
  NoiseKind,
  Swizzle,
  ToneMapKind,
  TslFacade,
  VectorType,
  VoronoiDistance,
  VoronoiMetric,
} from '@nudo-tsl/core'
import { compose } from './code-expression'
import type { CodeExpression, HelperName } from './code-expression'
import { formatNumber } from './literals'

/** The `three/tsl` export each comparison is printed with. */
const COMPARISONS: Readonly<Record<CompareOp, string>> = {
  lt: 'lessThan',
  lte: 'lessThanEqual',
  gt: 'greaterThan',
  gte: 'greaterThanEqual',
  eq: 'equal',
}

const PERLIN_NOISE = 'mx_noise_float'
const SIMPLEX_NOISE: HelperName = 'simplexNoise3'
const WORLEY_NOISE_VEC2 = 'mx_worley_noise_vec2'
const WORLEY_NOISE_VEC3 = 'mx_worley_noise_vec3'
const CELL_NOISE = 'mx_cell_noise_float'

const CELL_SEARCHES: Readonly<Record<CellDimensions, HelperName>> = {
  2: 'voronoiCell2',
  3: 'voronoiCell3',
}

const MINKOWSKI_DISTANCES: Readonly<Record<CellDimensions, HelperName>> = {
  2: 'voronoiMinkowski2',
  3: 'voronoiMinkowski3',
}

const MINKOWSKI_CELL_SEARCHES: Readonly<Record<CellDimensions, HelperName>> = {
  2: 'voronoiMinkowskiCell2',
  3: 'voronoiMinkowskiCell3',
}

const HASHES: Readonly<Record<HashKind, HelperName>> = {
  float: 'hashFloat',
  vec3: 'hashVec3',
}

const COLOR_SPACE_CONVERSIONS: Readonly<Record<ColorSpaceDirection, string>> = {
  'srgb-to-linear': 'sRGBTransferEOTF',
  'linear-to-srgb': 'sRGBTransferOETF',
}

/** The `three/tsl` tone mapping function each Tone Map curve is printed with. */
const TONE_MAPPINGS: Readonly<Record<ToneMapKind, string>> = {
  'aces-filmic': 'acesFilmicToneMapping',
  agx: 'agxToneMapping',
  neutral: 'neutralToneMapping',
  reinhard: 'reinhardToneMapping',
  cineon: 'cineonToneMapping',
  linear: 'linearToneMapping',
}

/** The module export that holds the shared Main Light uniforms. */
export const LIGHTS_OBJECT = 'lights'

/** The key of each Main Light component in the `lights` export. */
export const MAIN_LIGHT_KEYS: Readonly<Record<MainLightComponent, string>> = {
  direction: 'mainLightDirection',
  color: 'mainLightColor',
}

/** The order the `lights` export lists its components in. */
export const MAIN_LIGHT_ORDER: readonly MainLightComponent[] = ['direction', 'color']

const joinCodes = (args: readonly CodeExpression[]): string =>
  args.map((arg) => arg.code).join(', ')

/** `name(a, b)`, importing `name` from `three/tsl`. */
const call = (name: string, args: readonly CodeExpression[]): CodeExpression =>
  compose(`${name}(${joinCodes(args)})`, args, { imports: [name] })

/** `receiver.name`: a swizzle such as `.xyz`. */
const member = (receiver: CodeExpression, name: string): CodeExpression =>
  compose(`${receiver.code}.${name}`, [receiver])

/** `receiver.method(a, b)`: the receiver is always a call, a member or an identifier. */
const method = (
  receiver: CodeExpression,
  name: string,
  args: readonly CodeExpression[],
): CodeExpression => compose(`${receiver.code}.${name}(${joinCodes(args)})`, [receiver, ...args])

/** A call to a helper the module declares itself. */
const callHelper = (name: HelperName, args: readonly CodeExpression[]): CodeExpression =>
  compose(`${name}(${joinCodes(args)})`, args, { helpers: [name] })

const printMetric = (metric: VoronoiMetric): CodeExpression =>
  compose(formatNumber(WORLEY_METRIC_IDS[metric]), [])

const printDistance = (distance: VoronoiDistance): CodeExpression =>
  compose(formatNumber(VORONOI_DISTANCE_IDS[distance]), [])

/**
 * F1 and F2 under `metric`. Euclidean keeps the call it has always printed, so old graphs print
 * the same module; the other metrics read the first two of MaterialX's three nearest distances.
 */
function worleyDistances(
  p: CodeExpression,
  jitter: CodeExpression,
  metric: VoronoiMetric,
): CodeExpression {
  if (metric === 'euclidean') return call(WORLEY_NOISE_VEC2, [p, jitter])
  return member(call(WORLEY_NOISE_VEC3, [p, jitter, printMetric(metric)]), 'xy')
}

const printPart = (part: CodeExpression | number): CodeExpression =>
  typeof part === 'number' ? compose(formatNumber(part), []) : part

function construct(type: VectorType, parts: readonly (CodeExpression | number)[]): CodeExpression {
  const printed = parts.map(printPart)
  return compose(`${type}(${joinCodes(printed)})`, printed, { imports: [type] })
}

/**
 * Prints each facade call as TSL source: arithmetic as method chains (`a.mul(b)`), everything else
 * as a call to the `three/tsl` export. Semantically it matches the live facade call for call.
 */
export function createCodeFacade(): TslFacade<CodeExpression> {
  return {
    add: (a, b) => method(a, 'add', [b]),
    sub: (a, b) => method(a, 'sub', [b]),
    mul: (a, b) => method(a, 'mul', [b]),
    div: (a, b) => method(a, 'div', [b]),
    sin: (a) => call('sin', [a]),
    cos: (a) => call('cos', [a]),
    abs: (a) => call('abs', [a]),
    fract: (a) => call('fract', [a]),
    floor: (a) => call('floor', [a]),
    min: (a, b) => call('min', [a, b]),
    max: (a, b) => call('max', [a, b]),
    exp: (a) => call('exp', [a]),
    pow: (a, b) => call('pow', [a, b]),
    atan2: (y, x) => call('atan', [y, x]),
    oneMinus: (a) => call('oneMinus', [a]),
    clamp: (x, low, high) => call('clamp', [x, low, high]),
    dot: (a, b) => call('dot', [a, b]),
    length: (a) => call('length', [a]),
    normalize: (a) => call('normalize', [a]),
    distance: (a, b) => call('distance', [a, b]),
    reflect: (i, n) => call('reflect', [i, n]),
    refract: (i, n, eta) => call('refract', [i, n, eta]),
    toneMap: (kind, color, exposure) => call(TONE_MAPPINGS[kind], [color, exposure]),
    mix: (a, b, t) => call('mix', [a, b, t]),
    step: (edge, x) => call('step', [edge, x]),
    smoothstep: (edge0, edge1, x) => call('smoothstep', [edge0, edge1, x]),
    fwidth: (x) => call('fwidth', [x]),
    dFdx: (x) => call('dFdx', [x]),
    dFdy: (x) => call('dFdy', [x]),
    remap: (x, inLow, inHigh, outLow, outHigh) =>
      call('remap', [x, inLow, inHigh, outLow, outHigh]),
    select: (op, a, b, whenTrue, whenFalse) =>
      call('select', [call(COMPARISONS[op], [a, b]), whenTrue, whenFalse]),
    noise: (kind: NoiseKind, p) =>
      kind === 'perlin' ? call(PERLIN_NOISE, [p]) : callHelper(SIMPLEX_NOISE, [p]),
    tiledNoise: (p, period) => callHelper('tiledNoise3', [p, period]),
    voronoi: worleyDistances,
    voronoiCell: (dimensions, p, jitter, metric) =>
      callHelper(CELL_SEARCHES[dimensions], [p, jitter, printMetric(metric)]),
    voronoiMinkowski: (dimensions, p, jitter, exponent) =>
      callHelper(MINKOWSKI_DISTANCES[dimensions], [p, jitter, exponent]),
    voronoiMinkowskiCell: (dimensions, p, jitter, exponent) =>
      callHelper(MINKOWSKI_CELL_SEARCHES[dimensions], [p, jitter, exponent]),
    tiledVoronoi: (p, jitter, distance, exponent, period) =>
      callHelper('tiledVoronoi2', [p, jitter, printDistance(distance), exponent, period]),
    cellNoise: (p) => call(CELL_NOISE, [p]),
    hash: (kind, p, seed) => callHelper(HASHES[kind], [p, seed]),
    checker: (uv) => call('checker', [uv]),
    textureSample: (texture, uv, level) => {
      const sampled = method(texture, 'sample', [uv])
      return level === null ? sampled : method(sampled, 'level', [level])
    },
    colorSpace: (direction, color) => call(COLOR_SPACE_CONVERSIONS[direction], [color]),
    sceneColor: (uv) => member(call('viewportSharedTexture', [uv]), 'xyz'),
    sceneDepthFade: (distance) => callHelper('sceneDepthFade', [distance]),
    normalFromHeight: (height, strength) => callHelper('normalFromHeight', [height, strength]),
    mainLight: (component) => compose(`${LIGHTS_OBJECT}.${MAIN_LIGHT_KEYS[component]}`, []),
    builtin: (name) => compose(name === 'uv' ? 'uv()' : name, [], { imports: [name] }),
    construct,
    swizzle: (value, components: Swizzle) => member(value, components),
  }
}
