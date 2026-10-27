import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const floorNode = defineNode({
  type: 'math/floor',
  category: 'math',
  label: 'Floor',
  description: 'Rounds the input down to the nearest whole number.',
  formula: 'floor(In)',
  keywords: ['floor', 'round', 'integer', 'quantize'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to round down.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'The nearest whole number at or below In: 2.7 becomes 2, -0.5 becomes -1.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.floor(inputs.in) }),
})
