import type { PortRef, PortValue } from '@nudo-tsl/core'
import { portKey } from '@nudo-tsl/core'
import { applyInputValue } from './apply-input-value'
import type { ApplyInputValueResult } from './apply-input-value'
import { OPACITY_INPUT, isTranslucent } from './create-material'
import type { MaterialBuild } from './create-material'

/**
 * Applies an inline value to a build in place. Opacity also decides whether the material takes the
 * transparent render path, so it is kept in step here; only an unconnected opacity has a uniform,
 * so a connected one (always transparent) is never touched.
 */
export function applyBuildInputValue(
  build: MaterialBuild,
  ref: PortRef,
  value: PortValue,
): ApplyInputValueResult {
  const result = applyInputValue(build.uniforms, ref, value)
  if (result !== 'applied' || portKey(ref) !== OPACITY_INPUT) return result
  if (build.material === null || value.type !== 'float') return result

  const transparent = isTranslucent(value.value)
  if (build.material.transparent === transparent) return result
  build.material.transparent = transparent
  // Blending is baked into the render pipeline, so it has to be created again.
  build.material.needsUpdate = true
  return result
}
