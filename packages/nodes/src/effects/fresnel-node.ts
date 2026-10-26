import { concrete, defineNode, float } from '@nudo-tsl/core'

export const fresnelNode = defineNode({
  type: 'effects/fresnel',
  category: 'effects',
  label: 'Fresnel',
  description: 'Brightens surfaces seen at grazing angles, useful for rim light.',
  keywords: ['fresnel', 'rim', 'edge', 'glow'],
  inputs: [{ id: 'power', label: 'Power', type: concrete('float'), default: float(5) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl, inputs }) => {
    const facing = tsl.dot(tsl.builtin('normalView'), tsl.builtin('positionViewDirection'))
    const clampedFacing = tsl.clamp(
      facing,
      tsl.construct('float', [0]),
      tsl.construct('float', [1]),
    )
    return { out: tsl.pow(tsl.oneMinus(clampedFacing), inputs.power) }
  },
})
