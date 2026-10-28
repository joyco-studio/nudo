import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const lerpNode = defineNode({
  type: 'interpolation/lerp',
  category: 'interpolation',
  label: 'Lerp',
  description: 'Blends from A to B by the factor T, where 0 is A and 1 is B.',
  formula: 'lerp(A, B, T)',
  keywords: ['lerp', 'mix', 'blend', 'interpolate'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The result when T is 0.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The result when T is 1.',
    },
    {
      id: 't',
      label: 'T',
      type: concrete('float'),
      default: float(0.5),
      description: 'How much of B: 0 = all A, 1 = all B, 0.5 = half of each.',
    },
  ],
  outputs: [
    { id: 'out', label: 'Out', type: generic(TYPE_GROUP), description: 'The blend of A and B.' },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.mix(inputs.a, inputs.b, inputs.t) }),
})
