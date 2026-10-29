import { concrete, defineNode, vec3 } from '@nudo-tsl/core'

const UNLIT_FACING = 0
const HALF = 0.5

export const mainLightNode = defineNode({
  type: 'input/main-light',
  category: 'input',
  label: 'Main Light',
  description:
    "The scene's key light: its direction and color, plus ready-made Lambert and half-Lambert shading for custom lighting and toon looks.",
  keywords: ['light', 'sun', 'directional', 'lambert', 'diffuse', 'shading', 'toon', 'ndotl'],
  inputs: [
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'normalWorld',
      description:
        'The surface normal to shade, in world space; the world normal when nothing is plugged in.',
    },
  ],
  outputs: [
    {
      id: 'direction',
      label: 'Direction',
      type: concrete('vec3'),
      description:
        'Direction from the surface toward the light, in world space, with a length of 1.',
    },
    {
      id: 'color',
      label: 'Color',
      type: concrete('vec3'),
      description: 'The light color multiplied by its intensity.',
    },
    {
      id: 'lambert',
      label: 'Lambert',
      type: concrete('float'),
      description: 'How much the surface faces the light: 1 head-on, 0 edge-on or facing away.',
    },
    {
      id: 'halfLambert',
      label: 'Half Lambert',
      type: concrete('float'),
      description: 'Lambert squeezed into 0 to 1 so the dark side keeps a soft gradient.',
    },
  ],
  build: ({ tsl, inputs }) => {
    const direction = tsl.mainLight('direction')
    const facing = tsl.dot(tsl.normalize(inputs.normal), direction)
    const half = tsl.construct('float', [HALF])
    return {
      direction,
      color: tsl.mainLight('color'),
      lambert: tsl.max(facing, tsl.construct('float', [UNLIT_FACING])),
      halfLambert: tsl.add(tsl.mul(facing, half), half),
    }
  },
})
