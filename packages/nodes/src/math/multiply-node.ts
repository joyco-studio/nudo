import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const multiplyNode = defineNode({
  type: 'math/multiply',
  category: 'math',
  label: 'Multiply',
  description: 'Multiplies two values, component by component: use it to scale, tint or mask.',
  formula: 'A × B',
  keywords: ['multiply', 'mul', 'times', 'scale', '*'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The value to scale.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'How much to scale A by: 0 zeroes it, 1 keeps it, 2 doubles it.',
    },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP), description: 'A times B.' }],
  build: ({ tsl, inputs }) => ({ out: tsl.mul(inputs.a, inputs.b) }),
})
