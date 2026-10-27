import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const sinNode = defineNode({
  type: 'math/sin',
  category: 'math',
  label: 'Sine',
  description: 'Sine of the input, a smooth wave between -1 and 1.',
  formula: 'sin(In)',
  keywords: ['sin', 'sine', 'wave', 'oscillate'],
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
      description: 'A wave between -1 and 1 that starts at 0.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.sin(inputs.in) }),
})
