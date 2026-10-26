import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

export const fresnelNode = defineNode({
  type: 'effects/fresnel',
  category: 'effects',
  label: 'Fresnel',
  description: 'Brightens surfaces seen at grazing angles, useful for rim light.',
  keywords: ['fresnel', 'rim', 'edge', 'glow'],
  inputs: [
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'normalView',
    },
    {
      id: 'viewDir',
      label: 'View Dir',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'positionViewDirection',
    },
    { id: 'power', label: 'Power', type: concrete('float'), default: float(5) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
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
