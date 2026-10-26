import { portKey } from '@nudo-tsl/core'
import type { PortKey, PortRef, PortValue } from '@nudo-tsl/core'
import { Vector2, Vector3, Vector4 } from 'three'
import type { LiveUniform } from './live-backend'

/**
 * Pushes a new inline value into its live uniform in place, so nothing is recompiled.
 * Returns false when there is no uniform for the port or the value's type does not match the
 * uniform's kind; the caller must then recompile.
 */
export function applyInputValue(
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
  ref: PortRef,
  value: PortValue,
): boolean {
  const uniform = uniforms.get(portKey(ref))
  if (uniform === undefined) return false

  const current = uniform.value
  if (value.type === 'float' && typeof current === 'number') {
    uniform.value = value.value
    return true
  }
  if (value.type === 'vec2' && current instanceof Vector2) {
    current.set(...value.value)
    return true
  }
  if (value.type === 'vec3' && current instanceof Vector3) {
    current.set(...value.value)
    return true
  }
  if (value.type === 'vec4' && current instanceof Vector4) {
    current.set(...value.value)
    return true
  }
  return false
}
