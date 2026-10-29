import { Fn, dot, fract, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * White noise from a point, after Dave Hoskins' "hash without sine" (MIT, shadertoy.com/view/4djSRW,
 * `hash13` and `hash33`). It only uses fract, multiply and add, so every GPU and both backends give
 * the same values, and it needs no integer math. Three's own `hash` is no substitute: it truncates
 * its input to an integer, which collapses a continuous point such as UV into a few values.
 * Returns floats in [0, 1).
 */

/** Multiplied into the point first, so a float (repeated into all three axes) is not symmetric. */
const AXIS_SKEW = [1, 1.6180339887, 2.7182818285] as const
/** Per-axis scale of the point before its fraction is taken. */
const HASH_SCALE = [0.1031, 0.103, 0.0973] as const
/** Moves each seed to its own offset: the plastic constant's powers spread seeds evenly. */
const SEED_STRIDE = [0.7548776662, 0.569840291, 0.430159709] as const
const MIX_OFFSET = 33.33

/** Adds the mix of all three axes to each axis. */
const mixAxes = (value: Node<'vec3'>): Node<'vec3'> =>
  value.add(dot(value, value.yxz.add(MIX_OFFSET)))

/**
 * Two rounds of scale, fraction and mix. One round leaves a point that moves a little (a pixel of
 * UV) with a nearly unchanged value; the second makes neighbors unrelated.
 */
const scrambledPoint = (pointInput: Node<'vec3'>, seed: Node<'float'>): Node<'vec3'> => {
  const point = vec3(pointInput).mul(vec3(...AXIS_SKEW))
  const seedOffset = fract(seed.mul(vec3(...SEED_STRIDE)))
  const firstRound = mixAxes(fract(point.mul(vec3(...HASH_SCALE)).add(seedOffset))).toVar()
  return mixAxes(fract(firstRound.mul(vec3(...HASH_SCALE))))
}

export const hashFloat = Fn(([pointInput, seed]: [Node<'vec3'>, Node<'float'>]) => {
  const scrambled = scrambledPoint(pointInput, seed).toVar()
  return fract(scrambled.y.add(scrambled.z).mul(scrambled.x))
})

export const hashVec3 = Fn(([pointInput, seed]: [Node<'vec3'>, Node<'float'>]) => {
  const scrambled = scrambledPoint(pointInput, seed).toVar()
  return fract(scrambled.xxy.add(scrambled.yxx).mul(scrambled.zyx))
})
