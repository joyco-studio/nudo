import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const divideNode = defineNode({
  type: 'math/divide',
  category: 'math',
  label: 'Divide',
  description: 'Divides A by B, component by component.',
  keywords: ['divide', 'division', 'ratio', '/'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(1) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.div(inputs.a, inputs.b) }),
})
