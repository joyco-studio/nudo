import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const cosNode = defineNode({
  type: 'math/cos',
  category: 'math',
  label: 'Cosine',
  description: 'Cosine of the input, a smooth wave between -1 and 1 that starts at 1.',
  formula: 'cos(In)',
  keywords: ['cos', 'cosine', 'wave', 'oscillate'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The angle in radians; plug Time to make it move.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'A wave between -1 and 1 that starts at 1.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.cos(inputs.in) }),
})
