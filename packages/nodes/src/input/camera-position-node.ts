import { concrete, defineNode } from '@nudo-tsl/core'

export const cameraPositionNode = defineNode({
  type: 'input/camera-position',
  category: 'input',
  label: 'Camera Position',
  description: 'Where the camera is, in world space.',
  keywords: ['camera', 'position', 'eye', 'world'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The camera position in world space.',
    },
  ],
  build: ({ tsl }) => ({ out: tsl.builtin('cameraPosition') }),
})
