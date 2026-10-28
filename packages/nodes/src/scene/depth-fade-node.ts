import { concrete, defineNode, float } from '@nudo-tsl/core'

export const depthFadeNode = defineNode({
  type: 'scene/depth-fade',
  category: 'scene',
  label: 'Depth Fade',
  description: 'Fades from 0 to 1 as the scene behind the surface gets further away.',
  keywords: ['depth', 'fade', 'soft', 'intersection', 'shore', 'foam', 'edge'],
  inputs: [
    {
      id: 'distance',
      label: 'Distance',
      type: concrete('float'),
      default: float(1),
      description: 'How far behind the surface, in scene units, the fade reaches 1.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: '0 where the surface touches what is behind it, 1 once that is Distance away.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.sceneDepthFade(inputs.distance) }),
})
