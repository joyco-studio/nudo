import type { MessageKey } from '@/i18n/translate'

export const PRIMITIVE_SHAPES = [
  'sphere',
  'cube',
  'plane',
  'torus',
  'knot',
  'suzanne',
] as const

export type PrimitiveShape = (typeof PRIMITIVE_SHAPES)[number]

/** A built-in mesh, or the model the user loaded from a file. */
export type PreviewShape = PrimitiveShape | 'model'

/** How the mesh picker names a shape. Suzanne is Blender's monkey: a name in every language. */
export function shapeLabelKey(shape: PreviewShape): MessageKey {
  return `preview.shape.${shape}`
}

export const DEFAULT_SHAPE: PreviewShape = 'sphere'

export function isPreviewShape(value: string): value is PreviewShape {
  return value === 'model' || PRIMITIVE_SHAPES.some((shape) => shape === value)
}
