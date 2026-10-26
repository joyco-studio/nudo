import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const floorNode = defineNode({
  type: 'math/floor',
  category: 'math',
  label: 'Floor',
  description: 'Rounds the input down to the nearest whole number.',
  keywords: ['floor', 'round', 'integer', 'quantize'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.floor(inputs.in) }),
})
