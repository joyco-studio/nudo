import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const lengthNode = defineNode({
  type: 'vector/length',
  category: 'vector',
  label: 'Length',
  description: 'Length of a vector, its distance from the origin.',
  formula: '√(x² + y² + …)',
  keywords: ['length', 'magnitude', 'size', 'norm'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The vector to measure.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'How long In is, never negative.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.length(inputs.in) }),
})
