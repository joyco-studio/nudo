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
  formula: 'noise(P × Scale)',
  keywords: ['noise', 'perlin', 'simplex', 'random', 'clouds', 'procedural'],
  inputs: [
    {
      id: 'p',
      label: 'P',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      description: 'Where to sample the noise; plug Position to stick it to the surface.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('float'),
      default: float(1),
      description: 'How busy the noise is: higher = smaller, denser blobs.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'Smooth random values, roughly between -1 and 1.',
    },
  ],
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
