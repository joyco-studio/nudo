import { concrete, defineNode } from '@nudo-tsl/core'

export const screenUvNode = defineNode({
  type: 'input/screen-uv',
  category: 'input',
  label: 'Screen UV',
  description: 'Position of the pixel on screen, from 0 to 1 across the viewport.',
  keywords: ['screen', 'uv', 'viewport', 'pixel', 'coordinates'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec2'),
      description: 'Where the pixel is on screen, 0 to 1 across the width and height of the view.',
    },
  ],
  build: ({ tsl }) => ({ out: tsl.builtin('screenUV') }),
})
