import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const smoothstepNode = defineNode({
  type: 'interpolation/smoothstep',
  category: 'interpolation',
  label: 'Smoothstep',
  description: 'Eases from 0 to 1 between two edges with a smooth S-shaped curve.',
  keywords: ['smoothstep', 'smooth', 'ease', 'threshold', 'falloff'],
  inputs: [
    { id: 'edge0', label: 'Edge 0', type: concrete('float'), default: float(0) },
    { id: 'edge1', label: 'Edge 1', type: concrete('float'), default: float(1) },
    { id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0.5) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.smoothstep(inputs.edge0, inputs.edge1, inputs.in) }),
})
