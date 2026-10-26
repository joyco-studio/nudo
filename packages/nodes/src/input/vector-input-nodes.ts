import { concrete, defineNode, splat } from '@nudo-tsl/core'
import type { VectorType } from '@nudo-tsl/core'

type VectorInputType = Exclude<VectorType, 'float'>

const IDENTITIES: Readonly<Record<VectorInputType, { typeId: string; label: string }>> = {
  vec2: { typeId: 'input/vector2', label: 'Vector 2' },
  vec3: { typeId: 'input/vector3', label: 'Vector 3' },
  vec4: { typeId: 'input/vector4', label: 'Vector 4' },
}

function defineVectorInput(type: VectorInputType) {
  const { typeId, label } = IDENTITIES[type]
  return defineNode({
    type: typeId,
    category: 'input',
    label,
    description: `A constant ${type} you can edit and feed into other nodes.`,
    keywords: ['vector', type, 'constant', 'value', 'xyz'],
    inputs: [{ id: 'value', label: 'Value', type: concrete(type), default: splat(type, 0) }],
    outputs: [{ id: 'out', label: 'Out', type: concrete(type) }],
    build: ({ inputs }) => ({ out: inputs.value }),
  })
}

export const vector2Node = defineVectorInput('vec2')
export const vector3Node = defineVectorInput('vec3')
export const vector4Node = defineVectorInput('vec4')
