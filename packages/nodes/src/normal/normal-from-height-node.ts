import { concrete, defineNode, float } from '@nudo-tsl/core'

export const normalFromHeightNode = defineNode({
  type: 'normal/normal-from-height',
  category: 'normal',
  label: 'Normal From Height',
  description: 'Builds a view-space normal from how a height value changes across the surface.',
  keywords: ['normal', 'height', 'bump', 'derivative', 'relief', 'ripple'],
  inputs: [
    { id: 'height', label: 'Height', type: concrete('float'), default: float(0) },
    { id: 'strength', label: 'Strength', type: concrete('float'), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl, inputs }) => ({ out: tsl.normalFromHeight(inputs.height, inputs.strength) }),
})
