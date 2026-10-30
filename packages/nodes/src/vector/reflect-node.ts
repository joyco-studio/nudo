import { concrete, defineNode, vec3 } from '@nudo-tsl/core'

export const reflectNode = defineNode({
  type: 'vector/reflect',
  category: 'vector',
  label: 'Reflect',
  description:
    'Bounces a direction off a surface like a mirror: plug in the view ray and the normal to get the direction a reflection comes from.',
  formula: 'In − 2(N·In)N',
  keywords: ['reflect', 'reflection', 'mirror', 'bounce', 'environment', 'specular'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(0, 0, -1),
      description:
        'The direction arriving at the surface, length 1: from the camera toward the point for a reflection.',
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
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'In mirrored about the normal: the direction it leaves the surface in.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.reflect(inputs.in, inputs.normal) }),
})
