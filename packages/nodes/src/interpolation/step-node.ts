import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const stepNode = defineNode({
  type: 'interpolation/step',
  category: 'interpolation',
  label: 'Step',
  description: 'Returns 0 below the edge and 1 at or above it, a hard threshold.',
  formula: 'In < Edge ? 0 : 1',
  keywords: ['step', 'threshold', 'cutoff', 'mask'],
  inputs: [
    {
      id: 'edge',
      label: 'Edge',
      type: generic(TYPE_GROUP),
      default: float(0.5),
      description: 'The threshold: values of In below it give 0.',
    },
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to test against Edge.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: '0 where In is below Edge, 1 everywhere else.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.step(inputs.edge, inputs.in) }),
})
