import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const dotNode = defineNode({
  type: 'vector/dot',
  category: 'vector',
  label: 'Dot Product',
  description: 'Dot product of two vectors, a measure of how closely they point the same way.',
  keywords: ['dot', 'dot product', 'angle', 'alignment'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl, inputs }) => ({ out: tsl.dot(inputs.a, inputs.b) }),
})
