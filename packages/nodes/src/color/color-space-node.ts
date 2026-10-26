import { concrete, defineNode, vec3 } from '@nudo-tsl/core'
import type { ColorSpaceDirection } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const DEFAULT_DIRECTION: ColorSpaceDirection = 'srgb-to-linear'

const DIRECTION_OPTIONS: readonly EnumOption<ColorSpaceDirection>[] = [
  { value: 'srgb-to-linear', label: 'sRGB to Linear' },
  { value: 'linear-to-srgb', label: 'Linear to sRGB' },
]

export const colorSpaceNode = defineNode({
  type: 'color/color-space',
  category: 'color',
  label: 'Color Space',
  description: 'Converts a color between sRGB and linear color spaces.',
  keywords: ['color', 'space', 'srgb', 'linear', 'gamma', 'convert'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(1, 1, 1),
      widget: 'color',
    },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  params: [
    {
      id: 'direction',
      label: 'Direction',
      kind: 'enum',
      options: DIRECTION_OPTIONS,
      default: DEFAULT_DIRECTION,
    },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: tsl.colorSpace(
      resolveEnumParam(DIRECTION_OPTIONS, params.direction, DEFAULT_DIRECTION),
      inputs.in,
    ),
  }),
})
