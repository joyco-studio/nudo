export const DATA_TYPES = ['float', 'vec2', 'vec3', 'vec4', 'texture'] as const
export type DataType = (typeof DATA_TYPES)[number]
export type VectorType = Exclude<DataType, 'texture'>

export const VECTOR_TYPES: readonly VectorType[] = ['float', 'vec2', 'vec3', 'vec4']

/** Concrete type, or a generic "dynamic vector" resolved by inference (Unity-style). */
export type PortTypeSpec =
  | { kind: 'concrete'; type: DataType }
  | { kind: 'generic'; group: string; allowed: readonly VectorType[] }
