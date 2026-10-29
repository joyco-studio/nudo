import { Fn, dot, fract, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * White noise from a point, after Dave Hoskins' "hash without sine" (MIT,
 * shadertoy.com/view/4djSRW, `hash13` and `hash33`). It only uses fract, multiply and add, so every GPU and both backends give
 * the same values, and it needs no integer math. Three's own `hash` is no substitute: it truncates
 * its input to an integer, which collapses a continuous point such as UV into a few values.
 * Returns floats in [0, 1).
 *
 * Everything runs in float32, so a hash has only about 10 bits of distinct values over a UV: plenty
 * for grain, colors and scattering, but coarse for a hard threshold near 0 or 1.
 */

/** Multiplied into the point first, so a float (repeated into all three axes) is not symmetric. */
const AXIS_SKEW = [1, 1.6180339887, 2.7182818285] as const
/** Per-axis scale of the point before its fraction is taken. */
const HASH_SCALE = [0.1031, 0.103, 0.0973] as const
/** Moves each seed to its own offset: the plastic constant's powers spread seeds evenly. */
const SEED_STRIDE = [0.7548776662, 0.569840291, 0.430159709] as const
const MIX_OFFSET = 33.33
/**
 * Each output scrambles the point with its own seed offset, so its value does not depend on the
 * others. A shared scramble feeding all of them left the three Out3 channels correlated near the
 * origin (UV, seed 0), where the fresh node sits.
 */
const OUT_SHIFT = 0
const RED_SHIFT = 0.25
const GREEN_SHIFT = 0.5
const BLUE_SHIFT = 0.75

/** Adds the mix of all three axes to each axis. */
const mixAxes = (value: Node<'vec3'>): Node<'vec3'> =>
  value.add(dot(value, value.yxz.add(MIX_OFFSET)))

/**
 * Two rounds of scale, fraction and mix. One round leaves a point that moves a little (a pixel of
 * UV) with a nearly unchanged value; the second makes neighbors unrelated.
 */
const scrambledPoint = (
  pointInput: Node<'vec3'>,
  seed: Node<'float'>,
  shift: number,
): Node<'vec3'> => {
  const point = vec3(pointInput).mul(vec3(...AXIS_SKEW))
  const seedOffset = fract(seed.mul(vec3(...SEED_STRIDE)).add(shift))
  const firstRound = mixAxes(fract(point.mul(vec3(...HASH_SCALE)).add(seedOffset))).toVar()
  return mixAxes(fract(firstRound.mul(vec3(...HASH_SCALE))))
}

const hashChannel = (
  pointInput: Node<'vec3'>,
  seed: Node<'float'>,
  shift: number,
): Node<'float'> => {
  const scrambled = scrambledPoint(pointInput, seed, shift).toVar()
  return fract(scrambled.y.add(scrambled.z).mul(scrambled.x))
}

export const hashFloat = Fn(([pointInput, seed]: [Node<'vec3'>, Node<'float'>]) =>
  hashChannel(pointInput, seed, OUT_SHIFT),
)

export const hashVec3 = Fn(([pointInput, seed]: [Node<'vec3'>, Node<'float'>]) =>
  vec3(
    hashChannel(pointInput, seed, RED_SHIFT),
    hashChannel(pointInput, seed, GREEN_SHIFT),
    hashChannel(pointInput, seed, BLUE_SHIFT),
  ),
)
