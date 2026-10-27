export const PRIMITIVE_SHAPES = ['sphere', 'cube', 'plane', 'torus', 'knot', 'suzanne'] as const

export type PrimitiveShape = (typeof PRIMITIVE_SHAPES)[number]

/** A built-in mesh, or the model the user loaded from a file. */
export type PreviewShape = PrimitiveShape | 'model'

export const SHAPE_LABELS: Readonly<Record<PreviewShape, string>> = {
  sphere: 'Sphere',
  cube: 'Cube',
  plane: 'Plane',
  torus: 'Torus',
  knot: 'Knot',
  suzanne: 'Suzanne',
  model: 'Model',
}

export const DEFAULT_SHAPE: PreviewShape = 'sphere'

export function isPreviewShape(value: string): value is PreviewShape {
  return value === 'model' || PRIMITIVE_SHAPES.some((shape) => shape === value)
}
