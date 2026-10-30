import { Fn, dot, floor, fract, max, mix, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * 3D gradient (Perlin) noise that repeats. The lattice cell of each corner is wrapped every
 * `period` cells per axis before it is hashed into a gradient, so the noise at `point + period`
 * equals the noise at `point`; a period of 0 leaves that axis unwrapped. Periods are whole numbers.
 * The corner hash is Dave Hoskins' hash33 ("Hash without Sine", MIT), float-only so every GPU
 * agrees. Returns a float in roughly [-1, 1].
 */

const TILED_HASH_SCALE_X = 0.1031
const TILED_HASH_SCALE_Y = 0.103
const TILED_HASH_SCALE_Z = 0.0973
const TILED_HASH_OFFSET = 33.33
/** Brings the gradient noise to the spread of the simplex noise, about ±1 at most. */
const TILED_OUTPUT_SCALE = 1.4
const TILED_HALF = 0.5

/**
 * `cell` modulo `period` per axis, into [0, period); a 0 period leaves the axis as it is. The cell
 * is a whole number: nudging it by half keeps the division off a whole-number boundary, where a
 * GPU's rounded reciprocal could land just below it and break the repeat.
 */
const tiledWrapCell = (cell: Node<'vec3'>, period: Node<'vec3'>): Node<'vec3'> =>
  cell.sub(period.mul(floor(cell.add(TILED_HALF).div(max(period, 1)))))

/** A pseudo-random gradient in [-1, 1]³ for a whole-numbered lattice cell. */
const tiledCornerGradient = (cell: Node<'vec3'>): Node<'vec3'> => {
  const scrambled = fract(
    cell.mul(vec3(TILED_HASH_SCALE_X, TILED_HASH_SCALE_Y, TILED_HASH_SCALE_Z)),
  ).toVar()
  const mixed = scrambled.add(dot(scrambled, scrambled.yxz.add(TILED_HASH_OFFSET))).toVar()
  return fract(mixed.xxy.add(mixed.yxx).mul(mixed.zyx)).mul(2).sub(1)
}

export const tiledNoise3 = Fn(([pointInput, periodInput]: [Node<'vec3'>, Node<'vec3'>]) => {
  const point = vec3(pointInput).toVar()
  const period = vec3(periodInput).toVar()
  const base = floor(point).toVar()
  const local = point.sub(base).toVar()
  // Quintic fade: 6t⁵ − 15t⁴ + 10t³.
  const fade = local
    .mul(local)
    .mul(local)
    .mul(local.mul(local.mul(6).sub(15)).add(10))
    .toVar()

  const corner = (x: number, y: number, z: number): Node<'float'> => {
    const offset = vec3(x, y, z)
    return dot(tiledCornerGradient(tiledWrapCell(base.add(offset), period)), local.sub(offset))
  }

  const bottomFront = mix(corner(0, 0, 0), corner(1, 0, 0), fade.x)
  const topFront = mix(corner(0, 1, 0), corner(1, 1, 0), fade.x)
  const bottomBack = mix(corner(0, 0, 1), corner(1, 0, 1), fade.x)
  const topBack = mix(corner(0, 1, 1), corner(1, 1, 1), fade.x)

  return mix(mix(bottomFront, topFront, fade.y), mix(bottomBack, topBack, fade.y), fade.z).mul(
    TILED_OUTPUT_SCALE,
  )
})
