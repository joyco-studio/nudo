import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import type { NoiseKind } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const DEFAULT_KIND: NoiseKind = 'simplex'

const KIND_OPTIONS: readonly EnumOption<NoiseKind>[] = [
  { value: 'perlin', label: 'Perlin' },
  { value: 'simplex', label: 'Simplex' },
]

export const noiseNode = defineNode({
  type: 'effects/noise',
  category: 'effects',
  label: 'Noise',
  description: 'Smooth random values that vary across space, from Perlin or simplex noise.',
  keywords: ['noise', 'perlin', 'simplex', 'random', 'clouds', 'procedural'],
  inputs: [
    { id: 'p', label: 'P', type: concrete('vec3'), default: vec3(0, 0, 0) },
    { id: 'scale', label: 'Scale', type: concrete('float'), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    { id: 'kind', label: 'Kind', kind: 'enum', options: KIND_OPTIONS, default: DEFAULT_KIND },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: tsl.noise(
      resolveEnumParam(KIND_OPTIONS, params.kind, DEFAULT_KIND),
      tsl.mul(inputs.p, inputs.scale),
    ),
  }),
})
