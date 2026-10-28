import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const dotNode = defineNode({
  type: 'vector/dot',
  category: 'vector',
  label: 'Dot Product',
  description:
    'Measures how closely two directions line up: 1 when they match, 0 at right angles and -1 when opposite (for directions of length 1).',
  formula: 'A · B',
  keywords: ['dot', 'dot product', 'angle', 'alignment'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The first direction.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The second direction.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description:
        'Positive when A and B point the same way, 0 at right angles, negative when opposed.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.dot(inputs.a, inputs.b) }),
})
