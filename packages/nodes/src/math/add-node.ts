import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const addMathNode = defineNode({
  type: 'math/add',
  category: 'math',
  label: 'Add',
  description: 'Adds two values together, component by component.',
  formula: 'A + B',
  keywords: ['add', 'plus', 'sum', '+'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The starting value.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'What to add to A; negative numbers subtract.',
    },
  ],
  outputs: [
    { id: 'out', label: 'Out', type: generic(TYPE_GROUP), description: 'The sum of A and B.' },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.add(inputs.a, inputs.b) }),
})
