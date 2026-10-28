import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const subtractNode = defineNode({
  type: 'math/subtract',
  category: 'math',
  label: 'Subtract',
  description: 'Subtracts B from A, component by component.',
  formula: 'A − B',
  keywords: ['subtract', 'minus', 'difference', '-'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to subtract from.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'What to take away from A.',
    },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP), description: 'A minus B.' }],
  build: ({ tsl, inputs }) => ({ out: tsl.sub(inputs.a, inputs.b) }),
})
