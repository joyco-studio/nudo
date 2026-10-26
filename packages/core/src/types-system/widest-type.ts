import type { VectorType } from '../types/data-type'

const COMPONENT_COUNTS = { float: 1, vec2: 2, vec3: 3, vec4: 4 } as const satisfies Record<
  VectorType,
  1 | 2 | 3 | 4
>

export const componentCount = (type: VectorType): 1 | 2 | 3 | 4 => COMPONENT_COUNTS[type]

/** Widest vector type in the list, or null when the list is empty. */
export const widestType = (types: readonly VectorType[]): VectorType | null =>
  types.reduce<VectorType | null>(
    (widest, type) =>
      widest === null || componentCount(type) > componentCount(widest) ? type : widest,
    null,
  )
