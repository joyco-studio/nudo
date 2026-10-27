import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const minNode = defineNode({
  type: 'math/min',
  category: 'math',
  label: 'Min',
  description: 'Takes the smaller of two values, component by component.',
  formula: 'min(A, B)',
  keywords: ['min', 'minimum', 'smaller', 'lowest'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to limit.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The ceiling: the result never goes above it.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'Whichever of A and B is smaller.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.min(inputs.a, inputs.b) }),
})
