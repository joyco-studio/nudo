import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const powerNode = defineNode({
  type: 'math/power',
  category: 'math',
  label: 'Power',
  description: 'Raises A to the power of B.',
  formula: 'pow(A, B)',
  keywords: ['power', 'pow', 'exponent', 'square'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The value to raise; keep it at 0 or above.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(2),
      description: 'The exponent: above 1 darkens a 0 to 1 value, below 1 brightens it.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'A raised to the power of B.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.pow(inputs.a, inputs.b) }),
})
