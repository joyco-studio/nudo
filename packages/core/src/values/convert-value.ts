import type { VectorType } from '../types/data-type'
import type { PortValue, VectorPortValue } from '../types/port-value'
import { componentCount } from '../types-system/widest-type'
import { float, vec2, vec3, vec4 } from './port-value-factories'

const W_COMPONENT_INDEX = 3
const PAD_VALUE = 0
const PAD_VALUE_W = 1

const toComponents = (value: VectorPortValue): readonly number[] =>
  value.type === 'float' ? [value.value] : value.value

const componentAt = (components: readonly number[], index: number): number =>
  components[index] ?? PAD_VALUE

const resizeComponents = (source: readonly number[], targetCount: number): readonly number[] =>
  Array.from({ length: targetCount }, (_, index) => {
    if (source.length === 1) return componentAt(source, 0) // splat
    if (index < source.length) return componentAt(source, index) // keep or truncate
    return index === W_COMPONENT_INDEX ? PAD_VALUE_W : PAD_VALUE // pad
  })

const fromComponents = (type: VectorType, c: readonly number[]): PortValue => {
  switch (type) {
    case 'float':
      return float(componentAt(c, 0))
    case 'vec2':
      return vec2(componentAt(c, 0), componentAt(c, 1))
    case 'vec3':
      return vec3(componentAt(c, 0), componentAt(c, 1), componentAt(c, 2))
    case 'vec4':
      return vec4(componentAt(c, 0), componentAt(c, 1), componentAt(c, 2), componentAt(c, 3))
  }
}

/**
 * Converts a vector value to another vector type: float splats, wider-to-narrower truncates,
 * narrower-to-wider pads with 0 (and 1 for `w`). Texture values have no conversion and are
 * returned unchanged.
 */
export const convertValue = (value: PortValue, to: VectorType): PortValue => {
  if (value.type === 'texture' || value.type === to) return value
  return fromComponents(to, resizeComponents(toComponents(value), componentCount(to)))
}
