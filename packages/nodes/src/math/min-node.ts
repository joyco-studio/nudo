import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const minNode = defineNode({
  type: 'math/min',
  category: 'math',
  label: 'Min',
  description: 'Takes the smaller of two values, component by component.',
  keywords: ['min', 'minimum', 'smaller', 'lowest'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.min(inputs.a, inputs.b) }),
})
