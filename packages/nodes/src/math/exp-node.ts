import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const expNode = defineNode({
  type: 'math/exp',
  category: 'math',
  label: 'Exponential',
  description:
    'Raises e (about 2.718) to the power of the input, for curves that grow or fall off fast.',
  formula: 'exp(In)',
  keywords: ['exp', 'exponential', 'e', 'falloff'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The exponent; negative values fall off smoothly toward 0.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'Always above 0: e raised to the power of In.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.exp(inputs.in) }),
})
