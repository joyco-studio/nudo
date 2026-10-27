import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const clampNode = defineNode({
  type: 'math/clamp',
  category: 'math',
  label: 'Clamp',
  description: 'Limits the input to stay between a minimum and a maximum.',
  formula: 'clamp(In, Min, Max)',
  keywords: ['clamp', 'limit', 'saturate', 'range'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to limit.',
    },
    {
      id: 'min',
      label: 'Min',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The lowest the result can be.',
    },
    {
      id: 'max',
      label: 'Max',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The highest the result can be.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'In, held between Min and Max.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.clamp(inputs.in, inputs.min, inputs.max) }),
})
