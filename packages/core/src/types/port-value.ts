export type PortValue =
  | { type: 'float'; value: number }
  | { type: 'vec2'; value: readonly [number, number] }
  | { type: 'vec3'; value: readonly [number, number, number] }
  | { type: 'vec4'; value: readonly [number, number, number, number] }
  | { type: 'texture'; assetId: string | null }

export type VectorPortValue = Exclude<PortValue, { type: 'texture' }>
