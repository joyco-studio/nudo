import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

export const fresnelNode = defineNode({
  type: 'effects/fresnel',
  category: 'effects',
  label: 'Fresnel',
  description: 'Glows where the surface turns away from the camera, for rim light and soft edges.',
  formula: 'pow(1 − N·V, Power)',
  keywords: ['fresnel', 'rim', 'edge', 'glow'],
  inputs: [
    {
      id: 'normal',
      label: 'Normal',
      description: 'Which way the surface faces; the mesh normal when nothing is plugged in.',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'normalView',
    },
    {
      id: 'viewDir',
      label: 'View Dir',
      description: 'Direction toward the camera; filled in for you when nothing is plugged in.',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'positionViewDirection',
    },
    {
      id: 'power',
      label: 'Power',
      type: concrete('float'),
      default: float(5),
      description: 'How tight the rim is: higher = thinner rim.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: '0 where the surface faces the camera, rising toward 1 at its edges.',
    },
  ],
  build: ({ tsl, inputs }) => {
    const facing = tsl.dot(inputs.normal, inputs.viewDir)
    const clampedFacing = tsl.clamp(
      facing,
      tsl.construct('float', [0]),
      tsl.construct('float', [1]),
    )
    return { out: tsl.pow(tsl.oneMinus(clampedFacing), inputs.power) }
  },
})
