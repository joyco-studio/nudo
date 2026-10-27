import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const divideNode = defineNode({
  type: 'math/divide',
  category: 'math',
  label: 'Divide',
  description: 'Divides A by B, component by component.',
  formula: 'A ÷ B',
  keywords: ['divide', 'division', 'ratio', '/'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The value to divide.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'What to divide A by; keep it away from 0.',
    },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP), description: 'A divided by B.' }],
  build: ({ tsl, inputs }) => ({ out: tsl.div(inputs.a, inputs.b) }),
})
