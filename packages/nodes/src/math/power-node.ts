import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const powerNode = defineNode({
  type: 'math/power',
  category: 'math',
  label: 'Power',
  description: 'Raises A to the power of B.',
  keywords: ['power', 'pow', 'exponent', 'square'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(1) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(2) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.pow(inputs.a, inputs.b) }),
})
