import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const absNode = defineNode({
  type: 'math/abs',
  category: 'math',
  label: 'Absolute',
  description: 'Removes the sign of the input so the result is never negative.',
  keywords: ['abs', 'absolute', 'magnitude', 'positive'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.abs(inputs.in) }),
})
