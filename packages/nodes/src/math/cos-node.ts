import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const cosNode = defineNode({
  type: 'math/cos',
  category: 'math',
  label: 'Cosine',
  description: 'Cosine of the input, a smooth wave between -1 and 1 that starts at 1.',
  keywords: ['cos', 'cosine', 'wave', 'oscillate'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.cos(inputs.in) }),
})
