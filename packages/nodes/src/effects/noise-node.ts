import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import type { NoiseKind, ParamValue, TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'
import { PERIOD_3D, TILE_PARAM, isTiling, latticeTiling } from './tile-period'

/**
 * The Noise node's kinds: the facade's 3D noises, plus MaterialX's 2D Perlin, which reads P's X
 * and Y only. It is not the 3D Perlin at Z = 0: its own lattice gradients and scale, as
 * `mx_noise_float` gives a vec2.
 */
type NoiseNodeKind = NoiseKind | 'perlin-2d'

const DEFAULT_KIND: NoiseNodeKind = 'simplex'
const MIN_OCTAVES = 1
const MAX_OCTAVES = 8
const DEFAULT_OCTAVES = 1
const DEFAULT_ROUGHNESS = 0.5
const DEFAULT_LACUNARITY = 2
/**
 * Where the Color output's green and blue channels sample, away from red (which is Out itself), so
 * the three are unrelated, as in Blender's Noise Color. Any large offsets work.
 */
const GREEN_OFFSET = [19.1, 33.4, 47.2] as const
const BLUE_OFFSET = [74.2, -124.5, 99.4] as const
/** Out runs from -1 to 1; Color, like a Blender Noise Color, from 0 to 1. */
const HALF = 0.5

const KIND_OPTIONS: readonly EnumOption<NoiseNodeKind>[] = [
  { value: 'perlin', label: 'Perlin' },
  { value: 'simplex', label: 'Simplex' },
  { value: 'perlin-2d', label: 'Perlin 2D' },
]

/** The stored octave count, rounded and kept within the supported range. */
function resolveOctaves(stored: ParamValue | undefined): number {
  if (typeof stored !== 'number') return DEFAULT_OCTAVES
  return Math.min(MAX_OCTAVES, Math.max(MIN_OCTAVES, Math.round(stored)))
}

interface FractalNoiseInputs<E> {
  readonly kind: NoiseNodeKind
  readonly octaves: number
  readonly p: E
  /** Added to the scaled point, to sample an unrelated stretch of the same noise. */
  readonly offset: E | null
  readonly scale: E
  readonly roughness: E
  readonly lacunarity: E
  /** Set while the node tiles: the repeat, in units of `p`. */
  readonly period: E | null
}

/** Octave `octave`'s sample: plain noise, or tiled noise whose lattice repeats every period. */
function octaveSample<E>(
  tsl: TslFacade<E>,
  inputs: FractalNoiseInputs<E>,
  scaled: E,
  frequency: E | null,
): E {
  const { kind, period, scale } = inputs
  const point = frequency === null ? scaled : tsl.mul(scaled, frequency)
  if (period === null) {
    return kind === 'perlin-2d'
      ? tsl.noise('perlin', tsl.swizzle(point, 'xy'))
      : tsl.noise(kind, point)
  }
  const cells = tsl.mul(tsl.mul(period, scale), frequency ?? tsl.construct('float', [1]))
  const { lattice, fit } = latticeTiling(tsl, cells)
  return tsl.tiledNoise(tsl.mul(point, fit), lattice)
}

/**
 * Octave `i` samples at `scale * lacunarity^i` and weighs `roughness^i`. The sum is divided by the
 * summed weights so the range stays -1 to 1. One octave is the plain noise call. While tiling,
 * every octave's lattice repeats on whole cells, so the sum repeats too.
 */
function fractalNoise<E>(tsl: TslFacade<E>, inputs: FractalNoiseInputs<E>): E {
  const { octaves, p, offset, scale, roughness, lacunarity } = inputs
  const scaled = offset === null ? tsl.mul(p, scale) : tsl.add(tsl.mul(p, scale), offset)
  const base = octaveSample(tsl, inputs, scaled, null)
  if (octaves <= MIN_OCTAVES) return base

  let sum = base
  let totalAmplitude = tsl.construct('float', [1])
  for (let octave = 1; octave < octaves; octave++) {
    const exponent = tsl.construct('float', [octave])
    const amplitude = tsl.pow(roughness, exponent)
    const sample = octaveSample(tsl, inputs, scaled, tsl.pow(lacunarity, exponent))
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
    PERIOD_3D,
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'Smooth random values, roughly between -1 and 1.',
    },
    {
      id: 'color',
      label: 'Color',
      type: concrete('vec3'),
      description:
        "Three unrelated noises from 0 to 1, like Blender's Noise Color, to tint or to bend a vector.",
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
    TILE_PARAM,
  ],
  build: ({ tsl, inputs, params }) => {
    const sample = (offset: readonly number[] | null) =>
      fractalNoise(tsl, {
        kind: resolveEnumParam(KIND_OPTIONS, params.kind, DEFAULT_KIND),
        octaves: resolveOctaves(params.octaves),
        p: inputs.p,
        offset: offset === null ? null : tsl.construct('vec3', offset),
        scale: inputs.scale,
        roughness: inputs.roughness,
        lacunarity: inputs.lacunarity,
        period: isTiling(params) ? inputs.period : null,
      })
    const out = sample(null)
    const half = tsl.construct('float', [HALF])
    const toUnit = (value: typeof out) => tsl.add(tsl.mul(value, half), half)
    return {
      out,
      color: tsl.construct('vec3', [
        toUnit(out),
        toUnit(sample(GREEN_OFFSET)),
        toUnit(sample(BLUE_OFFSET)),
      ]),
    }
  },
})
