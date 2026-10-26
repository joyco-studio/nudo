import { Fn, abs, dot, floor, max, min, step, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * 3D simplex noise, ported from Ian McEwan, Ashima Arts (MIT, "webgl-noise") after Stefan
 * Gustavson's reference implementation. Returns a float in roughly [-1, 1].
 */

const SKEW_FACTOR = 1 / 3
const UNSKEW_FACTOR = 1 / 6
const MOD_289_PERIOD = 289
const PERMUTE_MULTIPLIER = 34
const PERMUTE_OFFSET = 1
const GRADIENT_GRID_SIZE = 7
const GRADIENT_GRID_CELLS = GRADIENT_GRID_SIZE * GRADIENT_GRID_SIZE
const GRADIENT_SCALE = 2 / GRADIENT_GRID_SIZE
const GRADIENT_OFFSET = 1 / (2 * GRADIENT_GRID_SIZE) - 1
const TAYLOR_INVERSE_SQRT_OFFSET = 1.79284291400159
const TAYLOR_INVERSE_SQRT_SLOPE = 0.85373472095314
const FALLOFF_RADIUS = 0.6
const OUTPUT_SCALE = 42
const HALF = 0.5
/**
 * The gradient grid places some points exactly on the octahedron's equator (height 0), where
 * rounding decides which hemisphere they fall in. Real heights are multiples of 1/14, so this
 * margin only settles those ties, the same way on every GPU.
 */
const EQUATOR_TOLERANCE = 0.001

/**
 * Largest integer multiple of `period` not above `value`, for integral `value`. Nudging by half a
 * unit keeps the division away from an integer boundary, where a rounded reciprocal product could
 * land just below it and make the hash differ between GPUs.
 */
const integerQuotient = (value: Node<'vec4'>, period: number): Node<'vec4'> =>
  floor(value.add(HALF).mul(1 / period))

const mod289 = (x: Node<'vec4'>): Node<'vec4'> =>
  x.sub(integerQuotient(x, MOD_289_PERIOD).mul(MOD_289_PERIOD))

const permute = (x: Node<'vec4'>): Node<'vec4'> =>
  mod289(x.mul(PERMUTE_MULTIPLIER).add(PERMUTE_OFFSET).mul(x))

const taylorInverseSqrt = (r: Node<'vec4'>): Node<'vec4'> =>
  r.mul(-TAYLOR_INVERSE_SQRT_SLOPE).add(TAYLOR_INVERSE_SQRT_OFFSET)

export const simplexNoise3 = Fn(([pointInput]: [Node<'vec3'>]) => {
  const point = vec3(pointInput).toVar()

  // First corner of the simplex cell, then the three other corners.
  const cell = floor(point.add(dot(point, vec3(SKEW_FACTOR)))).toVar()
  const x0 = point
    .sub(cell)
    .add(dot(cell, vec3(UNSKEW_FACTOR)))
    .toVar()

  const greater = step(x0.yzx, x0).toVar()
  const lesser = greater.oneMinus().toVar()
  const i1 = min(greater, lesser.zxy).toVar()
  const i2 = max(greater, lesser.zxy).toVar()

  const x1 = x0.sub(i1).add(UNSKEW_FACTOR).toVar()
  const x2 = x0
    .sub(i2)
    .add(2 * UNSKEW_FACTOR)
    .toVar()
  const x3 = x0.sub(0.5).toVar()

  // Hash the four corners into pseudo-random values.
  const wrappedCell = mod289(vec4(cell, 0)).xyz.toVar()
  const hashed = permute(
    permute(
      permute(vec4(0, i1.z, i2.z, 1).add(wrappedCell.z))
        .add(vec4(0, i1.y, i2.y, 1))
        .add(wrappedCell.y),
    )
      .add(vec4(0, i1.x, i2.x, 1))
      .add(wrappedCell.x),
  ).toVar()

  // Gradients: a 7x7 grid mapped onto an octahedron.
  const cellIndex = hashed
    .sub(integerQuotient(hashed, GRADIENT_GRID_CELLS).mul(GRADIENT_GRID_CELLS))
    .toVar()
  const column = integerQuotient(cellIndex, GRADIENT_GRID_SIZE).toVar()
  const row = cellIndex.sub(column.mul(GRADIENT_GRID_SIZE)).toVar()
  const gridX = column.mul(GRADIENT_SCALE).add(GRADIENT_OFFSET).toVar()
  const gridY = row.mul(GRADIENT_SCALE).add(GRADIENT_OFFSET).toVar()
  const height = vec4(1).sub(abs(gridX)).sub(abs(gridY)).toVar()

  const b0 = vec4(gridX.x, gridX.y, gridY.x, gridY.y).toVar()
  const b1 = vec4(gridX.z, gridX.w, gridY.z, gridY.w).toVar()
  const s0 = floor(b0).mul(2).add(1).toVar()
  const s1 = floor(b1).mul(2).add(1).toVar()
  const lowerHalf = step(height.sub(EQUATOR_TOLERANCE), vec4(0)).negate().toVar()

  const a0 = b0.xzyw.add(s0.xzyw.mul(lowerHalf.xxyy)).toVar()
  const a1 = b1.xzyw.add(s1.xzyw.mul(lowerHalf.zzww)).toVar()

  const g0 = vec3(a0.x, a0.y, height.x).toVar()
  const g1 = vec3(a0.z, a0.w, height.y).toVar()
  const g2 = vec3(a1.x, a1.y, height.z).toVar()
  const g3 = vec3(a1.z, a1.w, height.w).toVar()

  // Normalise the gradients.
  const normalisation = taylorInverseSqrt(vec4(dot(g0, g0), dot(g1, g1), dot(g2, g2), dot(g3, g3)))
  const n0 = g0.mul(normalisation.x)
  const n1 = g1.mul(normalisation.y)
  const n2 = g2.mul(normalisation.z)
  const n3 = g3.mul(normalisation.w)

  // Blend the contribution of each corner.
  const falloff = max(
    vec4(FALLOFF_RADIUS).sub(vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3))),
    0,
  ).toVar()
  const weights = falloff.mul(falloff).toVar()
  const contributions = vec4(dot(n0, x0), dot(n1, x1), dot(n2, x2), dot(n3, x3))

  return dot(weights.mul(weights), contributions).mul(OUTPUT_SCALE)
})
