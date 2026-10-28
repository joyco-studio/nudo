import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const oneMinusNode = defineNode({
  type: 'math/one-minus',
  category: 'math',
  label: 'One Minus',
  description: 'Computes 1 minus the input, which inverts a 0 to 1 value.',
  formula: '1 − In',
  keywords: ['one minus', 'invert', 'inverse', 'complement', 'flip'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to invert, usually between 0 and 1.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: '1 minus In: 0 becomes 1 and 1 becomes 0.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.oneMinus(inputs.in) }),
})
