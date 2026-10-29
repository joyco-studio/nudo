import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const atan2Node = defineNode({
  type: 'math/atan2',
  category: 'math',
  label: 'Arctangent 2',
  description:
    'The angle of the point (X, Y) around the origin, in radians: for radial gradients and polar UVs.',
  formula: 'atan2(Y, X)',
  keywords: ['atan2', 'arctangent', 'atan', 'angle', 'polar', 'radial', 'direction', 'swirl'],
  inputs: [
    {
      id: 'y',
      label: 'Y',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The vertical coordinate of the point, measured from the origin.',
    },
    {
      id: 'x',
      label: 'X',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The horizontal coordinate of the point, measured from the origin.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'The angle from the +X axis, from -3.14 to 3.14: 0 points right, 1.57 up.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.atan2(inputs.y, inputs.x) }),
})
