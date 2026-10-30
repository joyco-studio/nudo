import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

/** Air into water: the ratio of their indices of refraction, 1 ÷ 1.33. */
const AIR_TO_WATER = 0.75

export const refractNode = defineNode({
  type: 'vector/refract',
  category: 'vector',
  label: 'Refract',
  description:
    'Bends a direction as it passes into glass or water: plug in the view ray and the normal to get the direction light travels inside.',
  formula: 'refract(In, N, Ratio)',
  keywords: ['refract', 'refraction', 'bend', 'glass', 'water', 'ior', 'snell'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(0, 0, -1),
      description:
        'The direction arriving at the surface, length 1: from the camera toward the point to look through it.',
    },
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 1, 0),
      fallback: 'normalWorld',
      description:
        'Which way the surface faces, length 1; the mesh normal when nothing is plugged in.',
    },
    {
      id: 'ratio',
      label: 'Ratio',
      type: concrete('float'),
      default: float(AIR_TO_WATER),
      description:
        'The IOR outside ÷ the IOR inside: 0.75 from air into water, 0.67 into glass, 1 bends nothing.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description:
        'In bent through the surface; zero where it skims too low to enter (total internal reflection).',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.refract(inputs.in, inputs.normal, inputs.ratio) }),
})
