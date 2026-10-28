import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const fractNode = defineNode({
  type: 'math/fract',
  category: 'math',
  label: 'Fract',
  description: 'Keeps only the fractional part of the input, useful for repeating patterns.',
  formula: 'In − floor(In)',
  keywords: ['fract', 'fraction', 'repeat', 'tile', 'frac'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to wrap; multiply UV first to repeat a pattern.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'What is left after the decimal point, from 0 up to almost 1.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.fract(inputs.in) }),
})
