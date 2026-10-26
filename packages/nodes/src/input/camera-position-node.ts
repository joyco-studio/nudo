import { concrete, defineNode } from '@nudo-tsl/core'

export const cameraPositionNode = defineNode({
  type: 'input/camera-position',
  category: 'input',
  label: 'Camera Position',
  description: 'Position of the camera in world space.',
  keywords: ['camera', 'position', 'eye', 'world'],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl }) => ({ out: tsl.builtin('cameraPosition') }),
})
