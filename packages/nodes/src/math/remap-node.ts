import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const remapNode = defineNode({
  type: 'math/remap',
  category: 'math',
  label: 'Remap',
  description: 'Maps the input from one range of values to another.',
  formula: '[In Min–Max] → [Out Min–Max]',
  keywords: ['remap', 'map', 'range', 'rescale', 'normalize'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0.5),
      description: 'The value to convert.',
    },
    {
      id: 'inMin',
      label: 'In Min',
      type: concrete('float'),
      default: float(0),
      description: 'The In value that lands on Out Min.',
    },
    {
      id: 'inMax',
      label: 'In Max',
      type: concrete('float'),
      default: float(1),
      description: 'The In value that lands on Out Max.',
    },
    {
      id: 'outMin',
      label: 'Out Min',
      type: concrete('float'),
      default: float(0),
      description: 'Where In Min ends up.',
    },
    {
      id: 'outMax',
      label: 'Out Max',
      type: concrete('float'),
      default: float(1),
      description: 'Where In Max ends up.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description:
        'In moved to the new range; values outside the old range land outside the new one.',
    },
  ],
  build: ({ tsl, inputs }) => ({
    out: tsl.remap(inputs.in, inputs.inMin, inputs.inMax, inputs.outMin, inputs.outMax),
  }),
})
