import { portKey } from '@nudo-tsl/core'
import type { PortKey, PortRef, PortValue } from '@nudo-tsl/core'
import { Vector2, Vector3, Vector4 } from 'three'
import type { LiveUniform } from './live-backend'

export type ApplyInputValueResult =
  /** The uniform now holds the value. */
  | 'applied'
  /** The build has no uniform for the port (for instance its node cannot reach the master). */
  | 'missing'
  /** The value's type differs from the uniform's kind; only a recompile can represent it. */
  | 'mismatch'

/** Writes a value into a uniform of the same kind, in place; `mismatch` when the kinds differ. */
export function assignUniformValue(
  uniform: LiveUniform,
  value: PortValue,
): Exclude<ApplyInputValueResult, 'missing'> {
  const current = uniform.value
  if (value.type === 'float' && typeof current === 'number') {
    uniform.value = value.value
    return 'applied'
  }
  if (value.type === 'vec2' && current instanceof Vector2) {
    current.set(...value.value)
    return 'applied'
  }
  if (value.type === 'vec3' && current instanceof Vector3) {
    current.set(...value.value)
    return 'applied'
  }
  if (value.type === 'vec4' && current instanceof Vector4) {
    current.set(...value.value)
    return 'applied'
  }
  return 'mismatch'
}

/**
 * Pushes a new inline value into its live uniform in place, so nothing is recompiled.
 * `missing` means nothing in the material reads the port, so the edit has no visible effect;
 * `mismatch` means the caller must recompile.
 */
export function applyInputValue(
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
  ref: PortRef,
  value: PortValue,
): ApplyInputValueResult {
  const uniform = uniforms.get(portKey(ref))
  if (uniform === undefined) return 'missing'
  return assignUniformValue(uniform, value)
}
