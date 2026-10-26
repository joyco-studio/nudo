import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'

export const checkerboardNode = defineNode({
  type: 'effects/checkerboard',
  category: 'effects',
  label: 'Checkerboard',
  description: 'Alternating 0 and 1 squares across the UV.',
  keywords: ['checkerboard', 'checker', 'chess', 'tiles', 'grid', 'pattern'],
  inputs: [
    { id: 'uv', label: 'UV', type: concrete('vec2'), default: vec2(0, 0), fallback: 'uv' },
    { id: 'scale', label: 'Scale', type: concrete('float'), default: float(8) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl, inputs }) => ({ out: tsl.checker(tsl.mul(inputs.uv, inputs.scale)) }),
})
