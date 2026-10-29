import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'
const DEFAULT_STEPS = 4

export const posterizeNode = defineNode({
  type: 'math/posterize',
  category: 'math',
  label: 'Posterize',
  description: 'Snaps the input to a fixed number of flat levels, like a poster print.',
  formula: 'floor(In × Steps) / Steps',
  keywords: ['posterize', 'quantize', 'steps', 'bands', 'levels', 'toon'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to snap, usually between 0 and 1.',
    },
    {
      id: 'steps',
      label: 'Steps',
      type: concrete('float'),
      default: float(DEFAULT_STEPS),
      description: 'How many levels to snap to: 2 gives two flat bands, 8 gives eight.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'In rounded down to the nearest level, so the gradient turns into bands.',
    },
  ],
  build: ({ tsl, inputs }) => ({
    out: tsl.div(tsl.floor(tsl.mul(inputs.in, inputs.steps)), inputs.steps),
  }),
})
