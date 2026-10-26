import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const multiplyNode = defineNode({
  type: 'math/multiply',
  category: 'math',
  label: 'Multiply',
  description: 'Multiplies two values together, component by component.',
  keywords: ['multiply', 'mul', 'times', 'scale', '*'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(1) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.mul(inputs.a, inputs.b) }),
})
