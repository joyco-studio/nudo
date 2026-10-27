import type { PortRef, PortValue } from '@nudo-tsl/core'
import { isTranslucent, portKey } from '@nudo-tsl/core'
import { applyInputValue } from './apply-input-value'
import type { ApplyInputValueResult } from './apply-input-value'
import { OPACITY_INPUT } from './create-material'
import type { MaterialBuild } from './create-material'

/**
 * Applies an inline value to a build in place. On an `auto` surface, opacity also decides whether
 * the material takes the transparent render path, so it is kept in step here; only an unconnected
 * opacity has a uniform, so a connected one (always transparent) is never touched. An explicit
 * `opaque` or `transparent` surface fixes the render path, so opacity never changes it.
 */
export function applyBuildInputValue(
  build: MaterialBuild,
  ref: PortRef,
  value: PortValue,
): ApplyInputValueResult {
  const result = applyInputValue(build.uniforms, ref, value)
  if (result !== 'applied' || portKey(ref) !== OPACITY_INPUT) return result
  if (build.material === null || build.surface !== 'auto' || value.type !== 'float') return result

  const transparent = isTranslucent(value.value)
  if (build.material.transparent === transparent) return result
  build.material.transparent = transparent
  // Blending is baked into the render pipeline, so it has to be created again.
  build.material.needsUpdate = true
  return result
}
