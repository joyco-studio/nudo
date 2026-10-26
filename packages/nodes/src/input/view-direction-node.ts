import { concrete, defineNode } from '@nudo-tsl/core'

export const viewDirectionNode = defineNode({
  type: 'input/view-direction',
  category: 'input',
  label: 'View Direction',
  description: 'Direction from the surface point toward the camera, in view space.',
  keywords: ['view', 'direction', 'camera', 'eye', 'incident'],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl }) => ({ out: tsl.builtin('positionViewDirection') }),
})
