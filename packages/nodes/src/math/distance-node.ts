import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const distanceNode = defineNode({
  type: 'math/distance',
  category: 'math',
  label: 'Distance',
  description: 'Measures how far apart two points are.',
  formula: 'length(A − B)',
  keywords: ['distance', 'length', 'gap', 'between'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The first point.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The second point.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'The straight-line distance between A and B, never negative.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.distance(inputs.a, inputs.b) }),
})
