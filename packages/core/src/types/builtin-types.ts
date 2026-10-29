import type { VectorType } from './data-type'
import type { BuiltinName } from './tsl-facade'

/** The type of the value each builtin stands for, as an input's `fallback` supplies it. */
export const BUILTIN_TYPES: Readonly<Record<BuiltinName, VectorType>> = {
  time: 'float',
  deltaTime: 'float',
  uv: 'vec2',
  normalWorld: 'vec3',
  normalView: 'vec3',
  normalLocal: 'vec3',
  positionLocal: 'vec3',
  positionWorld: 'vec3',
  positionViewDirection: 'vec3',
  positionView: 'vec3',
  screenUV: 'vec2',
  cameraPosition: 'vec3',
  modelScale: 'vec3',
}
