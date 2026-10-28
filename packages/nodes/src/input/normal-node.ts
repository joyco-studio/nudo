import { concrete, defineNode } from '@nudo-tsl/core'

export const normalNode = defineNode({
  type: 'input/normal',
  category: 'input',
  label: 'Normal',
  description: 'The direction the surface faces, in world space.',
  keywords: ['normal', 'surface', 'direction', 'world'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The surface direction in world space, with a length of 1.',
    },
  ],
  build: ({ tsl }) => ({ out: tsl.builtin('normalWorld') }),
})
