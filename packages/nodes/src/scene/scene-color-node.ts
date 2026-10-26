import { concrete, defineNode, vec2 } from '@nudo-tsl/core'

export const sceneColorNode = defineNode({
  type: 'scene/scene-color',
  category: 'scene',
  label: 'Scene Color',
  description: 'The color rendered behind the surface, for refraction and see-through effects.',
  keywords: ['scene', 'color', 'screen', 'refraction', 'background', 'grab', 'behind'],
  inputs: [
    {
      id: 'uv',
      label: 'UV',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'screenUV',
    },
    { id: 'offset', label: 'Offset', type: concrete('vec2'), default: vec2(0, 0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl, inputs }) => ({ out: tsl.sceneColor(tsl.add(inputs.uv, inputs.offset)) }),
})
