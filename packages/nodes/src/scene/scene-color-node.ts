import { concrete, defineNode, vec2 } from '@nudo-tsl/core'

export const sceneColorNode = defineNode({
  type: 'scene/scene-color',
  category: 'scene',
  label: 'Scene Color',
  description: 'The color rendered behind the surface, for refraction and see-through effects.',
  formula: 'scene(UV + Offset)',
  keywords: ['scene', 'color', 'screen', 'refraction', 'background', 'grab', 'behind'],
  inputs: [
    {
      id: 'uv',
      label: 'UV',
      description: 'Where on screen to read; this pixel when nothing is plugged in.',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'screenUV',
    },
    {
      id: 'offset',
      label: 'Offset',
      type: concrete('vec2'),
      default: vec2(0, 0),
      description: 'Shifts where the scene is read; a little noise here makes refraction.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The color of whatever is behind the surface.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.sceneColor(tsl.add(inputs.uv, inputs.offset)) }),
})
