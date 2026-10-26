import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const sinNode = defineNode({
  type: 'math/sin',
  category: 'math',
  label: 'Sine',
  description: 'Sine of the input, a smooth wave between -1 and 1.',
  keywords: ['sin', 'sine', 'wave', 'oscillate'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.sin(inputs.in) }),
})
