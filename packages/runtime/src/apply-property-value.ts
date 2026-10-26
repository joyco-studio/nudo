import type { PortValue, PropertyId } from '@nudo-tsl/core'
import { TextureNode } from 'three/webgpu'
import { assignUniformValue } from './apply-input-value'
import type { ApplyInputValueResult } from './apply-input-value'
import type { MaterialBuild } from './create-material'
import type { LiveProperty, LiveUniform } from './live-backend'

// TextureNode extends UniformNode, so `instanceof` alone cannot narrow the union.
const isNumericUniform = (property: LiveProperty): property is LiveUniform =>
  !(property instanceof TextureNode)

/**
 * Pushes a new Blackboard property value into its live uniform in place, mirroring
 * `applyInputValue`. A texture property reports `mismatch`: swapping its asset needs the caller to
 * build the material again so the texture is resolved anew.
 */
export function applyPropertyValue(
  build: MaterialBuild,
  id: PropertyId,
  value: PortValue,
): ApplyInputValueResult {
  const property = build.properties.get(id)
  if (property === undefined) return 'missing'
  if (!isNumericUniform(property)) return 'mismatch'
  return assignUniformValue(property, value)
}
