import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const expNode = defineNode({
  type: 'math/exp',
  category: 'math',
  label: 'Exponential',
  description: 'Raises e to the power of the input.',
  keywords: ['exp', 'exponential', 'e', 'falloff'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.exp(inputs.in) }),
})
