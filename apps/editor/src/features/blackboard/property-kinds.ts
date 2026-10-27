import { float, texture, vec2, vec3, vec4 } from '@nudo-tsl/core'
import type { BlackboardProperty, PortValue, PropertyType } from '@nudo-tsl/core'

/** What the "+" menu offers: the property types, plus Color (a vec3 edited with the picker). */
export const PROPERTY_KINDS = ['float', 'vec2', 'vec3', 'vec4', 'color', 'texture'] as const
export type PropertyKind = (typeof PROPERTY_KINDS)[number]

export interface PropertyKindSpec {
  /** The menu item. */
  readonly label: string
  /** The type chip on the row. */
  readonly chip: string
  /** Default names are this base, numbered (`float1`, `color1`, …). */
  readonly nameBase: string
  readonly type: PropertyType
  readonly widget?: 'color'
  readonly defaultValue: PortValue
}

const WHITE = vec3(1, 1, 1)

export const PROPERTY_KIND_SPECS: Readonly<Record<PropertyKind, PropertyKindSpec>> = {
  float: {
    label: 'Float',
    chip: 'float',
    nameBase: 'float',
    type: 'float',
    defaultValue: float(0),
  },
  vec2: {
    label: 'Vector 2',
    chip: 'vec2',
    nameBase: 'vec2',
    type: 'vec2',
    defaultValue: vec2(0, 0),
  },
  vec3: {
    label: 'Vector 3',
    chip: 'vec3',
    nameBase: 'vec3',
    type: 'vec3',
    defaultValue: vec3(0, 0, 0),
  },
  vec4: {
    label: 'Vector 4',
    chip: 'vec4',
    nameBase: 'vec4',
    type: 'vec4',
    defaultValue: vec4(0, 0, 0, 0),
  },
  color: {
    label: 'Color',
    chip: 'color',
    nameBase: 'color',
    type: 'vec3',
    widget: 'color',
    defaultValue: WHITE,
  },
  texture: {
    label: 'Texture',
    chip: 'texture',
    nameBase: 'texture',
    type: 'texture',
    defaultValue: texture(null),
  },
}

/** The menu kind a stored property belongs to: a color-widget vec3 is a Color. */
export function propertyKindOf(
  property: Pick<BlackboardProperty, 'type' | 'widget'>,
): PropertyKind {
  if (property.widget === 'color' && property.type === 'vec3') return 'color'
  return property.type
}
