import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const stepNode = defineNode({
  type: 'interpolation/step',
  category: 'interpolation',
  label: 'Step',
  description: 'Returns 0 below the edge and 1 at or above it, a hard threshold.',
  keywords: ['step', 'threshold', 'cutoff', 'mask'],
  inputs: [
    { id: 'edge', label: 'Edge', type: generic(TYPE_GROUP), default: float(0.5) },
    { id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.step(inputs.edge, inputs.in) }),
})
