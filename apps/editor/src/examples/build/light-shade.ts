import { float, vec3 } from '@nudo-tsl/core'

import type { NodeSpec, PortPath, PropertySpec, WireSpec } from './example-spec'
import { node, reader } from './example-spec'

/**
 * How lit each point is, from a light the material carries itself: the hand-drawn examples shade
 * from this one number, the way spite's sketch posts shade from the luma of a lit render. Half
 * Lambert (N·L from -1…1 to 0…1) keeps the side turned away from the light a ramp, not flat black.
 */
export const LIGHT_DIRECTION: PropertySpec = {
  name: 'lightDirection',
  label: 'Light direction',
  value: vec3(0.6, 0.8, 0.5),
}

export const LIGHT_SHADE_NODES: readonly NodeSpec[] = [
  node('normal', 'input/normal'),
  reader('lightDirection', LIGHT_DIRECTION.name),
  node('lightNormalized', 'vector/normalize'),
  node('facing', 'vector/dot'),
  node('shade', 'math/remap', { inMin: float(-1), inMax: float(1) }),
]

export const LIGHT_SHADE_WIRES: readonly WireSpec[] = [
  ['lightDirection.out', 'lightNormalized.in'],
  ['normal.out', 'facing.a'],
  ['lightNormalized.out', 'facing.b'],
  ['facing.out', 'shade.in'],
]

/** 0 where the surface faces away from the light, 1 where it faces it. */
export const LIGHT_SHADE_OUT: PortPath = 'shade.out'
