import { concrete, defineNode, vec2 } from '@nudo-tsl/core'
import type { TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

type GradientMode = 'linear-x' | 'linear-y' | 'radial'

const DEFAULT_MODE: GradientMode = 'linear-x'
const UV_CENTER = 0.5
/** Distance from the center to an edge of the unit square is 0.5, so doubling reaches 1. */
const RADIAL_SCALE = 2

const MODE_OPTIONS: readonly EnumOption<GradientMode>[] = [
  { value: 'linear-x', label: 'Linear X' },
  { value: 'linear-y', label: 'Linear Y' },
  { value: 'radial', label: 'Radial' },
]

type GradientBuilder = <E>(tsl: TslFacade<E>, uv: E) => E

const GRADIENT_BUILDERS: Readonly<Record<GradientMode, GradientBuilder>> = {
  'linear-x': (tsl, uv) => tsl.swizzle(uv, 'x'),
  'linear-y': (tsl, uv) => tsl.swizzle(uv, 'y'),
  radial: (tsl, uv) => {
    const fromCenter = tsl.length(tsl.sub(uv, tsl.construct('float', [UV_CENTER])))
    return tsl.clamp(
      tsl.mul(fromCenter, tsl.construct('float', [RADIAL_SCALE])),
      tsl.construct('float', [0]),
      tsl.construct('float', [1]),
    )
  },
}

export const gradientNode = defineNode({
  type: 'effects/gradient',
  category: 'effects',
  label: 'Gradient',
  description: 'A ramp from 0 to 1 along X, along Y or outward from the center of the UV.',
  keywords: ['gradient', 'ramp', 'linear', 'radial', 'falloff', 'vignette'],
  inputs: [{ id: 'uv', label: 'UV', type: concrete('vec2'), default: vec2(0, 0), fallback: 'uv' }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    { id: 'mode', label: 'Mode', kind: 'enum', options: MODE_OPTIONS, default: DEFAULT_MODE },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: GRADIENT_BUILDERS[resolveEnumParam(MODE_OPTIONS, params.mode, DEFAULT_MODE)](
      tsl,
      inputs.uv,
    ),
  }),
})
