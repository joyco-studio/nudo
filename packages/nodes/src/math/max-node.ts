import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const maxNode = defineNode({
  type: 'math/max',
  category: 'math',
  label: 'Max',
  description: 'Takes the larger of two values, component by component.',
  formula: 'max(A, B)',
  keywords: ['max', 'maximum', 'larger', 'highest'],
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
      description: 'The floor: the result never goes below it.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'Whichever of A and B is larger.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.max(inputs.a, inputs.b) }),
})
