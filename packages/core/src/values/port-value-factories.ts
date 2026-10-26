import type { DataType, PortTypeSpec, VectorType } from '../types/data-type'
import { VECTOR_TYPES } from '../types/data-type'
import type { PortValue } from '../types/port-value'

export const float = (v: number): PortValue => ({ type: 'float', value: v })

export const vec2 = (x: number, y: number): PortValue => ({ type: 'vec2', value: [x, y] })

export const vec3 = (x: number, y: number, z: number): PortValue => ({
  type: 'vec3',
  value: [x, y, z],
})

export const vec4 = (x: number, y: number, z: number, w: number): PortValue => ({
  type: 'vec4',
  value: [x, y, z, w],
})

export const texture = (assetId: string | null = null): PortValue => ({ type: 'texture', assetId })

/** Fills every component of the given vector type with the same number. */
export const splat = (type: VectorType, v: number): PortValue => {
  switch (type) {
    case 'float':
      return float(v)
    case 'vec2':
      return vec2(v, v)
    case 'vec3':
      return vec3(v, v, v)
    case 'vec4':
      return vec4(v, v, v, v)
  }
}

export const concrete = (type: DataType): PortTypeSpec => ({ kind: 'concrete', type })

export const generic = (
  group: string,
  allowed: readonly VectorType[] = VECTOR_TYPES,
): PortTypeSpec => ({ kind: 'generic', group, allowed })
