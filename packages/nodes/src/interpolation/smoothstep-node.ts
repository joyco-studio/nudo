import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const smoothstepNode = defineNode({
  type: 'interpolation/smoothstep',
  category: 'interpolation',
  label: 'Smoothstep',
  description: 'Eases from 0 to 1 between two edges with a smooth S-shaped curve.',
  formula: 'smoothstep(Edge0, Edge1, In)',
  keywords: ['smoothstep', 'smooth', 'ease', 'threshold', 'falloff'],
  inputs: [
    {
      id: 'edge0',
      label: 'Edge 0',
      type: concrete('float'),
      default: float(0),
      description: 'Where the ramp starts: In at or below it gives 0.',
    },
    {
      id: 'edge1',
      label: 'Edge 1',
      type: concrete('float'),
      default: float(1),
      description: 'Where the ramp ends: In at or above it gives 1.',
    },
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0.5),
      description: 'The value to ease, often a gradient or noise.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'A smooth ramp from 0 to 1 between the two edges.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.smoothstep(inputs.edge0, inputs.edge1, inputs.in) }),
})
