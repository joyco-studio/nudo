import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const derivativesNode = defineNode({
  type: 'math/derivatives',
  category: 'math',
  label: 'Derivatives',
  description:
    'How fast a value changes from one pixel to the next on screen, for antialiasing and fading out detail too fine to draw. Fragment stage only.',
  formula: 'dFdx, dFdy, fwidth',
  keywords: ['derivative', 'ddx', 'ddy', 'dfdx', 'dfdy', 'fwidth', 'antialias', 'screen', 'slope'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to measure; it must vary across the surface to change at all.',
    },
  ],
  outputs: [
    {
      id: 'ddx',
      label: 'DDX',
      type: generic(TYPE_GROUP),
      description: 'How much In changes from this pixel to the next one to the right.',
    },
    {
      id: 'ddy',
      label: 'DDY',
      type: generic(TYPE_GROUP),
      description: 'How much In changes from this pixel to the next one up or down.',
    },
    {
      id: 'fwidth',
      label: 'Fwidth',
      type: generic(TYPE_GROUP),
      description: 'How much In changes across one pixel, whatever the direction: |DDX| + |DDY|.',
    },
  ],
  build: ({ tsl, inputs }) => ({
    ddx: tsl.dFdx(inputs.in),
    ddy: tsl.dFdy(inputs.in),
    fwidth: tsl.fwidth(inputs.in),
  }),
})
