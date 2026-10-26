import { PROPERTY_ID_PARAM, concrete, defineNode } from '@nudo-tsl/core'
import type { PropertyType } from '@nudo-tsl/core'

const PROPERTY_LABELS: Readonly<Record<PropertyType, string>> = {
  float: 'Float Property',
  vec2: 'Vec2 Property',
  vec3: 'Vec3 Property',
  vec4: 'Vec4 Property',
  texture: 'Texture Property',
}

/** Reader of a Blackboard property: `addPropertyNode` creates it with its `propertyId` set. */
function definePropertyNode(type: PropertyType) {
  return defineNode({
    type: `property/${type}`,
    category: 'input',
    label: PROPERTY_LABELS[type],
    description: `Reads a ${type} property from the Blackboard.`,
    keywords: ['property', 'blackboard', 'parameter', 'uniform', type],
    inputs: [],
    outputs: [{ id: 'out', label: 'Out', type: concrete(type) }],
    params: [
      { id: PROPERTY_ID_PARAM, label: 'Property', kind: 'string', default: '', hidden: true },
    ],
    reads: 'property',
    build: ({ property }) => {
      if (property === null) throw new Error('A property node needs a Blackboard property')
      return { out: property }
    },
  })
}

export const floatPropertyNode = definePropertyNode('float')
export const vec2PropertyNode = definePropertyNode('vec2')
export const vec3PropertyNode = definePropertyNode('vec3')
export const vec4PropertyNode = definePropertyNode('vec4')
export const texturePropertyNode = definePropertyNode('texture')
