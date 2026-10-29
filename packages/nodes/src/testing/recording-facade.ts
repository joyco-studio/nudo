import type { TslFacade } from '@nudo-tsl/core'

const formatParts = (parts: readonly (string | number)[]): string => `[${parts.join(',')}]`

/** A facade whose expressions are the printed calls, e.g. `mix(a,b,t)`. For tests. */
export function createRecordingFacade(): TslFacade<string> {
  return {
    add: (a, b) => `add(${a},${b})`,
    sub: (a, b) => `sub(${a},${b})`,
    mul: (a, b) => `mul(${a},${b})`,
    div: (a, b) => `div(${a},${b})`,
    sin: (a) => `sin(${a})`,
    cos: (a) => `cos(${a})`,
    abs: (a) => `abs(${a})`,
    fract: (a) => `fract(${a})`,
    floor: (a) => `floor(${a})`,
    min: (a, b) => `min(${a},${b})`,
    max: (a, b) => `max(${a},${b})`,
    exp: (a) => `exp(${a})`,
    pow: (a, b) => `pow(${a},${b})`,
    oneMinus: (a) => `oneMinus(${a})`,
    clamp: (x, low, high) => `clamp(${x},${low},${high})`,
    dot: (a, b) => `dot(${a},${b})`,
    length: (a) => `length(${a})`,
    normalize: (a) => `normalize(${a})`,
    distance: (a, b) => `distance(${a},${b})`,
    mix: (a, b, t) => `mix(${a},${b},${t})`,
    step: (edge, x) => `step(${edge},${x})`,
    smoothstep: (edge0, edge1, x) => `smoothstep(${edge0},${edge1},${x})`,
    fwidth: (x) => `fwidth(${x})`,
    remap: (x, inLow, inHigh, outLow, outHigh) =>
      `remap(${x},${inLow},${inHigh},${outLow},${outHigh})`,
    select: (op, a, b, whenTrue, whenFalse) => `select(${op},${a},${b},${whenTrue},${whenFalse})`,
    noise: (kind, p) => `noise(${kind},${p})`,
    voronoi: (p, jitter, metric) => `voronoi(${p},${jitter},${metric})`,
    voronoiCell: (dimensions, p, jitter, metric) =>
      `voronoiCell(${String(dimensions)},${p},${jitter},${metric})`,
    voronoiMinkowski: (dimensions, p, jitter, exponent) =>
      `voronoiMinkowski(${String(dimensions)},${p},${jitter},${exponent})`,
    voronoiMinkowskiCell: (dimensions, p, jitter, exponent) =>
      `voronoiMinkowskiCell(${String(dimensions)},${p},${jitter},${exponent})`,
    cellNoise: (p) => `cellNoise(${p})`,
    hash: (kind, p, seed) => `hash(${kind},${p},${seed})`,
    checker: (uv) => `checker(${uv})`,
    textureSample: (texture, uv, level) => `textureSample(${texture},${uv},${level ?? 'null'})`,
    colorSpace: (direction, color) => `colorSpace(${direction},${color})`,
    sceneColor: (uv) => `sceneColor(${uv})`,
    sceneDepthFade: (distance) => `sceneDepthFade(${distance})`,
    normalFromHeight: (height, strength) => `normalFromHeight(${height},${strength})`,
    mainLight: (component) => `mainLight(${component})`,
    builtin: (name) => `builtin(${name})`,
    construct: (type, parts) => `construct(${type},${formatParts(parts)})`,
    swizzle: (value, components) => `swizzle(${value},${components})`,
  }
}
