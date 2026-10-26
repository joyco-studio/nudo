import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const clampNode = defineNode({
  type: 'math/clamp',
  category: 'math',
  label: 'Clamp',
  description: 'Limits the input to stay between a minimum and a maximum.',
  keywords: ['clamp', 'limit', 'saturate', 'range'],
  inputs: [
    { id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'min', label: 'Min', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'max', label: 'Max', type: generic(TYPE_GROUP), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.clamp(inputs.in, inputs.min, inputs.max) }),
})
