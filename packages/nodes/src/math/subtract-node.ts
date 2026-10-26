import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const subtractNode = defineNode({
  type: 'math/subtract',
  category: 'math',
  label: 'Subtract',
  description: 'Subtracts B from A, component by component.',
  keywords: ['subtract', 'minus', 'difference', '-'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.sub(inputs.a, inputs.b) }),
})
