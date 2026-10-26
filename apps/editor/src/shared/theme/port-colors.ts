import type { DataType } from '@nudo-tsl/core'

export type PortLabel = '1' | '2' | '3' | '4' | 'T'

/** Port type colors. Always paired with `PORT_LABELS` so type never relies on color alone. */
export const PORT_COLORS: Readonly<Record<DataType, string>> = {
  float: 'oklch(0.78 0.12 200)',
  vec2: 'oklch(0.75 0.17 150)',
  vec3: 'oklch(0.82 0.16 80)',
  vec4: 'oklch(0.72 0.2 330)',
  texture: 'oklch(0.7 0.19 35)',
}

/** Short text shown on every port: component count for vectors, `T` for textures. */
export const PORT_LABELS: Readonly<Record<DataType, PortLabel>> = {
  float: '1',
  vec2: '2',
  vec3: '3',
  vec4: '4',
  texture: 'T',
}
