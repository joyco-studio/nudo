import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A float32 mirror of `hash-noise.ts`. The runtime tests never run a renderer, so this follows the
 * helper's math step by step (every operation rounded to float32, as on a GPU) to measure how its
 * outputs relate to each other. The constants are read from the helper's source, so they cannot
 * drift; the formulas must be kept in step with it by hand.
 */

type Vec3 = readonly [number, number, number]

const SOURCE = readFileSync(new URL('./hash-noise.ts', import.meta.url), 'utf8')

function readConstant(name: string): readonly number[] {
  const declaration = new RegExp(`const ${name} = (\\[[^\\]]*\\]|[\\d.]+)`).exec(SOURCE)
  if (declaration?.[1] === undefined) throw new Error(`hash-noise.ts declares no ${name}`)
  const values: unknown = JSON.parse(declaration[1])
  if (typeof values === 'number') return [values]
  if (!Array.isArray(values)) throw new Error(`${name} is not a list of numbers`)
  return values.map((value: unknown) => {
    if (typeof value !== 'number') throw new Error(`${name} holds a ${typeof value}`)
    return value
  })
}

const [AXIS_SKEW_X = 0, AXIS_SKEW_Y = 0, AXIS_SKEW_Z = 0] = readConstant('AXIS_SKEW')
const [HASH_SCALE_X = 0, HASH_SCALE_Y = 0, HASH_SCALE_Z = 0] = readConstant('HASH_SCALE')
const [SEED_STRIDE_X = 0, SEED_STRIDE_Y = 0, SEED_STRIDE_Z = 0] = readConstant('SEED_STRIDE')
const [MIX_OFFSET = 0] = readConstant('MIX_OFFSET')
const [OUT_SHIFT = 0] = readConstant('OUT_SHIFT')
const [RED_SHIFT = 0] = readConstant('RED_SHIFT')
const [GREEN_SHIFT = 0] = readConstant('GREEN_SHIFT')
const [BLUE_SHIFT = 0] = readConstant('BLUE_SHIFT')

const f32 = Math.fround
const fract = (value: number): number => f32(value - Math.floor(value))

const mixAxes = ([x, y, z]: Vec3): Vec3 => {
  const shared = f32(
    f32(f32(x * f32(y + f32(MIX_OFFSET))) + f32(y * f32(x + f32(MIX_OFFSET)))) +
      f32(z * f32(z + f32(MIX_OFFSET))),
  )
  return [f32(x + shared), f32(y + shared), f32(z + shared)]
}

const scrambledPoint = ([x, y, z]: Vec3, seed: number, shift: number): Vec3 => {
  const point: Vec3 = [
    f32(x * f32(AXIS_SKEW_X)),
    f32(y * f32(AXIS_SKEW_Y)),
    f32(z * f32(AXIS_SKEW_Z)),
  ]
  const offset: Vec3 = [
    fract(f32(f32(f32(seed) * f32(SEED_STRIDE_X)) + f32(shift))),
    fract(f32(f32(f32(seed) * f32(SEED_STRIDE_Y)) + f32(shift))),
    fract(f32(f32(f32(seed) * f32(SEED_STRIDE_Z)) + f32(shift))),
  ]
  const firstRound = mixAxes([
    fract(f32(f32(point[0] * f32(HASH_SCALE_X)) + offset[0])),
    fract(f32(f32(point[1] * f32(HASH_SCALE_Y)) + offset[1])),
    fract(f32(f32(point[2] * f32(HASH_SCALE_Z)) + offset[2])),
  ])
  return mixAxes([
    fract(f32(firstRound[0] * f32(HASH_SCALE_X))),
    fract(f32(firstRound[1] * f32(HASH_SCALE_Y))),
    fract(f32(firstRound[2] * f32(HASH_SCALE_Z))),
  ])
}

const hashChannel = (point: Vec3, seed: number, shift: number): number => {
  const [x, y, z] = scrambledPoint(point, seed, shift)
  return fract(f32(f32(y + z) * x))
}

const hashFloat = (point: Vec3, seed: number): number => hashChannel(point, seed, OUT_SHIFT)

const hashVec3 = (point: Vec3, seed: number): Vec3 => [
  hashChannel(point, seed, RED_SHIFT),
  hashChannel(point, seed, GREEN_SHIFT),
  hashChannel(point, seed, BLUE_SHIFT),
]

const GRID_SIZE = 256
const SEEDS = [0, 1, 3.7]
const MAX_CORRELATION = 0.03

const uvGrid = (): readonly Vec3[] =>
  Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index): Vec3 => [
    (index % GRID_SIZE) / GRID_SIZE,
    Math.floor(index / GRID_SIZE) / GRID_SIZE,
    0,
  ])

/** A repeatable stream of numbers in [0, 1): no `Math.random`, so a failure can be rerun. */
function createSequence(): () => number {
  let state = 123456789
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const positionSamples = (): readonly Vec3[] => {
  const next = createSequence()
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, (): Vec3 => [next(), next(), next()])
}

function correlation(first: readonly number[], second: readonly number[]): number {
  const meanOf = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length
  const firstMean = meanOf(first)
  const secondMean = meanOf(second)
  let covariance = 0
  let firstVariance = 0
  let secondVariance = 0
  first.forEach((value, index) => {
    const firstDelta = value - firstMean
    const secondDelta = (second[index] ?? 0) - secondMean
    covariance += firstDelta * secondDelta
    firstVariance += firstDelta ** 2
    secondVariance += secondDelta ** 2
  })
  return covariance / Math.sqrt(firstVariance * secondVariance)
}

interface Channels {
  readonly [name: string]: readonly number[]
}

function channelsAt(points: readonly Vec3[], seed: number): Channels {
  const hashed = points.map((point) => ({
    out: hashFloat(point, seed),
    out3: hashVec3(point, seed),
  }))
  return {
    out: hashed.map(({ out }) => out),
    'out3.x': hashed.map(({ out3 }) => out3[0]),
    'out3.y': hashed.map(({ out3 }) => out3[1]),
    'out3.z': hashed.map(({ out3 }) => out3[2]),
  }
}

/** The pair of channels with the strongest correlation, as `a vs b: r`. */
function strongestPair(channels: Channels): { readonly label: string; readonly value: number } {
  const names = Object.keys(channels)
  const pairs = names.flatMap((first, index) =>
    names.slice(index + 1).map((second) => ({
      label: `${first} vs ${second}`,
      value: Math.abs(correlation(channels[first] ?? [], channels[second] ?? [])),
    })),
  )
  return pairs.reduce((strongest, pair) => (pair.value > strongest.value ? pair : strongest))
}

describe('hash-noise float32 mirror', () => {
  const layouts: readonly (readonly [string, readonly Vec3[]])[] = [
    ['a UV grid (vec2, z = 0)', uvGrid()],
    ['positions in [0, 1)³', positionSamples()],
  ]

  describe.each(layouts)('over %s', (_name, points) => {
    it.each(SEEDS)('keeps Out and the three Out3 channels unrelated at seed %s', (seed) => {
      const strongest = strongestPair(channelsAt(points, seed))

      expect(strongest.value, strongest.label).toBeLessThan(MAX_CORRELATION)
    })
  })

  it('stays inside [0, 1)', () => {
    const channels = channelsAt(uvGrid(), 0)

    for (const values of Object.values(channels)) {
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...values)).toBeLessThan(1)
    }
  })

  it('is deterministic', () => {
    expect(channelsAt(uvGrid().slice(0, 500), 3.7)).toEqual(channelsAt(uvGrid().slice(0, 500), 3.7))
  })
})
