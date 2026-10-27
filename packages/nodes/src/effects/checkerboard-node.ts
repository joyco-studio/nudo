import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'

export const checkerboardNode = defineNode({
  type: 'effects/checkerboard',
  category: 'effects',
  label: 'Checkerboard',
  description: 'Alternating 0 and 1 squares across the UV.',
  formula: 'checker(UV × Scale)',
  keywords: ['checkerboard', 'checker', 'chess', 'tiles', 'grid', 'pattern'],
  inputs: [
    {
      id: 'uv',
      label: 'UV',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'uv',
      description: 'Where to sample the pattern; the mesh UV when nothing is plugged in.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('float'),
      default: float(8),
      description: 'How many squares fit across the UV.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: '1 on one set of squares and 0 on the other.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.checker(tsl.mul(inputs.uv, inputs.scale)) }),
})
