import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const moduloNode = defineNode({
  type: 'math/modulo',
  category: 'math',
  label: 'Modulo',
  description: 'The remainder of A divided by B; the result always has the sign of B.',
  formula: 'A mod B',
  keywords: ['modulo', 'mod', 'remainder', 'wrap', 'repeat', '%'],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value to wrap.',
    },
    {
      id: 'b',
      label: 'B',
      type: generic(TYPE_GROUP),
      default: float(1),
      description: 'The length of one repeat; keep it away from 0.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'A wrapped into the range from 0 up to B, the same on WebGPU and WebGL.',
    },
  ],
  // Floored on purpose: three's `mod` prints WGSL `%`, which truncates toward zero,
  // while GLSL `mod` floors. A − B × floor(A / B) gives the same result on both.
  build: ({ tsl, inputs }) => ({
    out: tsl.sub(inputs.a, tsl.mul(inputs.b, tsl.floor(tsl.div(inputs.a, inputs.b)))),
  }),
})
