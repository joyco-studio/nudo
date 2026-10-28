import { concrete, defineNode } from '@nudo-tsl/core'

export const uvNode = defineNode({
  type: 'input/uv',
  category: 'input',
  label: 'UV',
  description: 'Texture coordinates of the surface, from 0 to 1 across the mesh.',
  keywords: ['uv', 'texcoord', 'coordinates', 'texture'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec2'),
      description: 'The UV of the surface: x runs across the texture and y up it, 0 to 1.',
    },
  ],
  build: ({ tsl }) => ({ out: tsl.builtin('uv') }),
})
