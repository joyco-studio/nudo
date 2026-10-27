import { convertValue, float, vec2, vec3, vec4 } from '@nudo-tsl/core'
import type {
  DataType,
  GraphNode,
  InputDefinition,
  PortValue,
  VectorPortValue,
} from '@nudo-tsl/core'

/**
 * The value an unconnected input edits, in the input's resolved type. A generic input can resolve
 * wider than what was stored (vec3 → Add), so the stored value is converted for display.
 */
export function inlineValue(
  node: GraphNode,
  input: InputDefinition<string>,
  resolvedType: DataType,
): VectorPortValue | null {
  if (resolvedType === 'texture') return null
  const converted = convertValue(node.inputValues[input.id] ?? input.default, resolvedType)
  return converted.type === 'texture' ? null : converted
}

export function valueComponents(value: VectorPortValue): readonly number[] {
  return value.type === 'float' ? [value.value] : value.value
}

/** Returns `value` with the component at `index` replaced. */
export function withComponent(value: VectorPortValue, index: number, component: number): PortValue {
  const next = valueComponents(value).map((current, i) => (i === index ? component : current))
  const at = (i: number): number => next[i] ?? 0
  switch (value.type) {
    case 'float':
      return float(at(0))
    case 'vec2':
      return vec2(at(0), at(1))
    case 'vec3':
      return vec3(at(0), at(1), at(2))
    case 'vec4':
      return vec4(at(0), at(1), at(2), at(3))
  }
}

/** The asset a texture input points at, or `null` while no image is chosen. */
export function textureAssetId(node: GraphNode, input: InputDefinition<string>): string | null {
  const stored = node.inputValues[input.id] ?? input.default
  return stored.type === 'texture' ? stored.assetId : null
}
