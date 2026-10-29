import { MAIN_LIGHT_DEFAULTS } from '@nudo-tsl/core'
import type { MainLightComponent } from '@nudo-tsl/core'
import { Vector3 } from 'three'
import { uniform } from 'three/tsl'
import type { Node } from 'three/webgpu'

/** Unit vector toward the key light, in world space. Shared by every live material. */
export const mainLightDirection = uniform(new Vector3(...MAIN_LIGHT_DEFAULTS.direction))

/** Key light color × intensity, in linear light. Shared by every live material. */
export const mainLightColor = uniform(new Vector3(...MAIN_LIGHT_DEFAULTS.color))

export const MAIN_LIGHT_UNIFORMS: Readonly<Record<MainLightComponent, Node>> = {
  direction: mainLightDirection,
  color: mainLightColor,
}
