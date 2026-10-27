import { concrete, defineNode, float, texture, vec2 } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

type MipMode = 'auto' | 'level'

const DEFAULT_MIP: MipMode = 'auto'

const MIP_OPTIONS: readonly EnumOption<MipMode>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'level', label: 'Level' },
]

export const sampleTexture2dNode = defineNode({
  type: 'texture/sample-texture-2d',
  category: 'texture',
  label: 'Sample Texture 2D',
  description: 'Reads the color of a texture at a UV, with automatic or chosen mip level.',
  keywords: ['texture', 'sample', 'image', 'map', 'lookup', 'uv', 'mip'],
  inputs: [
    {
      id: 'texture',
      label: 'Texture',
      type: concrete('texture'),
      default: texture(null),
      description: 'The image to read.',
    },
    {
      id: 'uv',
      label: 'UV',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'uv',
      description: 'Where to read the image; the mesh UV when nothing is plugged in.',
    },
    {
      id: 'level',
      label: 'Level',
      type: concrete('float'),
      default: float(0),
      description: 'Which mip to read when Mip is set to Level: 0 = sharpest, higher = blurrier.',
    },
  ],
  outputs: [
    {
      id: 'rgba',
      label: 'RGBA',
      type: concrete('vec4'),
      description: 'The color and alpha at UV.',
    },
    { id: 'rgb', label: 'RGB', type: concrete('vec3'), description: 'The color at UV.' },
    { id: 'a', label: 'A', type: concrete('float'), description: 'The alpha (opacity) at UV.' },
  ],
  params: [{ id: 'mip', label: 'Mip', kind: 'enum', options: MIP_OPTIONS, default: DEFAULT_MIP }],
  build: ({ tsl, inputs, params }) => {
    const mip = resolveEnumParam(MIP_OPTIONS, params.mip, DEFAULT_MIP)
    const sample = tsl.textureSample(
      inputs.texture,
      inputs.uv,
      mip === 'level' ? inputs.level : null,
    )
    return { rgba: sample, rgb: tsl.swizzle(sample, 'xyz'), a: tsl.swizzle(sample, 'w') }
  },
})
