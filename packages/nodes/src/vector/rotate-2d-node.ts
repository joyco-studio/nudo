import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'

export const rotate2dNode = defineNode({
  type: 'vector/rotate-2d',
  category: 'vector',
  label: 'Rotate 2D',
  description: 'Rotates a 2D point around a center by an angle in radians.',
  formula: 'In ↻ Angle around Center',
  keywords: ['rotate', 'rotation', 'spin', 'angle', 'uv', '2d'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec2'),
      default: vec2(0, 0),
      description: 'The 2D point to rotate, usually UV.',
    },
    {
      id: 'angle',
      label: 'Angle',
      type: concrete('float'),
      default: float(0),
      description: 'How far to turn, in radians: 3.14 is half a turn.',
    },
    {
      id: 'center',
      label: 'Center',
      type: concrete('vec2'),
      default: vec2(0.5, 0.5),
      description: 'The point to turn around; 0.5, 0.5 is the middle of the UV.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec2'),
      description: 'In turned by Angle around Center.',
    },
  ],
  build: ({ tsl, inputs }) => {
    const offset = tsl.sub(inputs.in, inputs.center)
    const x = tsl.swizzle(offset, 'x')
    const y = tsl.swizzle(offset, 'y')
    const cosine = tsl.cos(inputs.angle)
    const sine = tsl.sin(inputs.angle)
    const rotated = tsl.construct('vec2', [
      tsl.sub(tsl.mul(x, cosine), tsl.mul(y, sine)),
      tsl.add(tsl.mul(x, sine), tsl.mul(y, cosine)),
    ])
    return { out: tsl.add(rotated, inputs.center) }
  },
})
