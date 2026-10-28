import { defineNode, generic, vec3 } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const normalizeNode = defineNode({
  type: 'vector/normalize',
  category: 'vector',
  label: 'Normalize',
  description: 'Scales a vector to a length of 1 while keeping its direction.',
  formula: 'In ÷ length(In)',
  keywords: ['normalize', 'unit', 'direction', 'normalise'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: vec3(0, 0, 1),
      description: 'The direction to normalize.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'In scaled to a length of 1, pointing the same way.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.normalize(inputs.in) }),
})
