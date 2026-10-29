import { concrete, defineNode, float, texture, vec3 } from '@nudo-tsl/core'

const WEIGHT_SUM_VECTOR: readonly number[] = [1, 1, 1]

export const triplanarNode = defineNode({
  type: 'texture/triplanar',
  category: 'texture',
  label: 'Triplanar',
  description:
    'Projects a texture along the three axes and blends the results by the surface normal: no UVs needed, no stretching on steep faces.',
  formula: 'Σ tex(plane) × weight',
  keywords: ['triplanar', 'texture', 'projection', 'box', 'mapping', 'world', 'uv-free', 'rock'],
  inputs: [
    {
      id: 'texture',
      label: 'Texture',
      type: concrete('texture'),
      default: texture(null),
      description: 'The image to project.',
    },
    {
      id: 'position',
      label: 'Position',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      fallback: 'positionLocal',
      description: 'Where to project the image; the object position when nothing is plugged in.',
    },
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      fallback: 'normalLocal',
      description: 'Decides which projection shows on each face; the object normal by default.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('float'),
      default: float(1),
      description: 'How many times the image repeats per unit of space.',
    },
    {
      id: 'sharpness',
      label: 'Sharpness',
      type: concrete('float'),
      default: float(1),
      description: 'How tight the blend between projections is: higher = narrower seams.',
    },
  ],
  outputs: [
    {
      id: 'rgba',
      label: 'RGBA',
      type: concrete('vec4'),
      description: 'The blended color and alpha.',
    },
    { id: 'rgb', label: 'RGB', type: concrete('vec3'), description: 'The blended color.' },
    { id: 'a', label: 'A', type: concrete('float'), description: 'The blended alpha (opacity).' },
  ],
  build: ({ tsl, inputs }) => {
    const powered = tsl.pow(tsl.abs(inputs.normal), inputs.sharpness)
    const weights = tsl.div(powered, tsl.dot(powered, tsl.construct('vec3', WEIGHT_SUM_VECTOR)))
    const project = (first: 'x' | 'y' | 'z', second: 'x' | 'y' | 'z', weight: 'x' | 'y' | 'z') => {
      const uv = tsl.mul(
        tsl.construct('vec2', [
          tsl.swizzle(inputs.position, first),
          tsl.swizzle(inputs.position, second),
        ]),
        inputs.scale,
      )
      return tsl.mul(tsl.textureSample(inputs.texture, uv, null), tsl.swizzle(weights, weight))
    }
    const rgba = tsl.add(
      tsl.add(project('y', 'z', 'x'), project('z', 'x', 'y')),
      project('x', 'y', 'z'),
    )
    return { rgba, rgb: tsl.swizzle(rgba, 'xyz'), a: tsl.swizzle(rgba, 'w') }
  },
})
