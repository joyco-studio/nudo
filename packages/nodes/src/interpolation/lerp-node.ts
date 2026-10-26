import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const lerpNode = defineNode({
  type: 'interpolation/lerp',
  category: 'interpolation',
  label: 'Lerp',
  description: 'Blends from A to B by the factor T, where 0 is A and 1 is B.',
  keywords: ['lerp', 'mix', 'blend', 'interpolate'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(1) },
    { id: 't', label: 'T', type: concrete('float'), default: float(0.5) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.mix(inputs.a, inputs.b, inputs.t) }),
})
