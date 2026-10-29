import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import type { NoiseKind, ParamValue, TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const DEFAULT_KIND: NoiseKind = 'simplex'
const MIN_OCTAVES = 1
const MAX_OCTAVES = 8
const DEFAULT_OCTAVES = 1
const DEFAULT_ROUGHNESS = 0.5
const DEFAULT_LACUNARITY = 2

const KIND_OPTIONS: readonly EnumOption<NoiseKind>[] = [
  { value: 'perlin', label: 'Perlin' },
  { value: 'simplex', label: 'Simplex' },
]

/** The stored octave count, rounded and kept within the supported range. */
function resolveOctaves(stored: ParamValue | undefined): number {
  if (typeof stored !== 'number') return DEFAULT_OCTAVES
  return Math.min(MAX_OCTAVES, Math.max(MIN_OCTAVES, Math.round(stored)))
}

interface FractalNoiseInputs<E> {
  readonly kind: NoiseKind
  readonly octaves: number
  readonly p: E
  readonly scale: E
  readonly roughness: E
  readonly lacunarity: E
}

/**
 * Octave `i` samples at `scale * lacunarity^i` and weighs `roughness^i`. The sum is divided by the
 * summed weights so the range stays -1 to 1. One octave is the plain noise call.
 */
function fractalNoise<E>(tsl: TslFacade<E>, inputs: FractalNoiseInputs<E>): E {
  const { kind, octaves, p, scale, roughness, lacunarity } = inputs
  const scaled = tsl.mul(p, scale)
  const base = tsl.noise(kind, scaled)
  if (octaves <= MIN_OCTAVES) return base

  let sum = base
  let totalAmplitude = tsl.construct('float', [1])
  for (let octave = 1; octave < octaves; octave++) {
    const exponent = tsl.construct('float', [octave])
    const amplitude = tsl.pow(roughness, exponent)
    const sample = tsl.noise(kind, tsl.mul(scaled, tsl.pow(lacunarity, exponent)))
    sum = tsl.add(sum, tsl.mul(sample, amplitude))
    totalAmplitude = tsl.add(totalAmplitude, amplitude)
  }
  return tsl.div(sum, totalAmplitude)
}

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
    {
      id: 'roughness',
      label: 'Roughness',
      type: concrete('float'),
      default: float(DEFAULT_ROUGHNESS),
      description: 'With more than one octave, how strongly each finer layer counts.',
    },
    {
      id: 'lacunarity',
      label: 'Lacunarity',
      type: concrete('float'),
      default: float(DEFAULT_LACUNARITY),
      description: 'With more than one octave, how much denser each layer is than the last.',
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
    {
      id: 'octaves',
      label: 'Octaves',
      kind: 'number',
      default: DEFAULT_OCTAVES,
      min: MIN_OCTAVES,
      max: MAX_OCTAVES,
      step: 1,
    },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: fractalNoise(tsl, {
      kind: resolveEnumParam(KIND_OPTIONS, params.kind, DEFAULT_KIND),
      octaves: resolveOctaves(params.octaves),
      p: inputs.p,
      scale: inputs.scale,
      roughness: inputs.roughness,
      lacunarity: inputs.lacunarity,
    }),
  }),
})
