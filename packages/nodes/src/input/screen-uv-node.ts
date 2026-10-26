import { concrete, defineNode } from '@nudo-tsl/core'

export const screenUvNode = defineNode({
  type: 'input/screen-uv',
  category: 'input',
  label: 'Screen UV',
  description: 'Position of the pixel on screen, from 0 to 1 across the viewport.',
  keywords: ['screen', 'uv', 'viewport', 'pixel', 'coordinates'],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec2') }],
  build: ({ tsl }) => ({ out: tsl.builtin('screenUV') }),
})
