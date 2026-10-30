import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A float32 mirror of `tiled-noise.ts`. The runtime tests never run a renderer, so this follows the
 * helper's math step by step (every operation rounded to float32, as on a GPU) to check that the
 * noise repeats every period and keeps a noise's spread. The constants are read from the helper's
 * source, so they cannot drift; the formulas must be kept in step with it by hand.
 */

type Vec3 = readonly [number, number, number]

const SOURCE = readFileSync(new URL('./tiled-noise.ts', import.meta.url), 'utf8')

function readConstant(name: string): number {
  const declaration = new RegExp(`const ${name} = ([\\d.]+)`).exec(SOURCE)
  if (declaration?.[1] === undefined) throw new Error(`tiled-noise.ts declares no ${name}`)
  return Number(declaration[1])
}

const HASH_SCALE: Vec3 = [
  readConstant('TILED_HASH_SCALE_X'),
  readConstant('TILED_HASH_SCALE_Y'),
  readConstant('TILED_HASH_SCALE_Z'),
]
const HASH_OFFSET = readConstant('TILED_HASH_OFFSET')
const OUTPUT_SCALE = readConstant('TILED_OUTPUT_SCALE')

const f = Math.fround
const fract = (x: number): number => f(x - Math.floor(x))
const map3 = (v: Vec3, fn: (x: number, axis: 0 | 1 | 2) => number): Vec3 => [
  fn(v[0], 0),
  fn(v[1], 1),
  fn(v[2], 2),
]
const dot = (a: Vec3, b: Vec3): number => f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]))
const mix = (a: number, b: number, t: number): number => f(a + f(f(b - a) * t))

function wrapCell(cell: Vec3, period: Vec3): Vec3 {
  return map3(cell, (c, axis) => {
    const p = period[axis]
    return f(c - f(p * Math.floor(f(f(c + 0.5) / Math.max(p, 1)))))
  })
}

function cornerGradient(cell: Vec3): Vec3 {
  const q = map3(cell, (c, axis) => fract(f(c * HASH_SCALE[axis])))
  const shifted: Vec3 = [f(q[1] + HASH_OFFSET), f(q[0] + HASH_OFFSET), f(q[2] + HASH_OFFSET)]
  const d = dot(q, shifted)
  const m = map3(q, (c) => f(c + d))
  const xxy: Vec3 = [m[0], m[0], m[1]]
  const yxx: Vec3 = [m[1], m[0], m[0]]
  const zyx: Vec3 = [m[2], m[1], m[0]]
  return map3(xxy, (c, axis) => f(f(fract(f(f(c + yxx[axis]) * zyx[axis])) * 2) - 1))
}

function tiledNoise(point: Vec3, period: Vec3): number {
  const base = map3(point, (c) => Math.floor(c))
  const local = map3(point, (c, axis) => f(c - base[axis]))
  const fade = map3(local, (t) => f(f(f(t * t) * t) * f(f(t * f(f(t * 6) - 15)) + 10)))
  const corner = (x: number, y: number, z: number): number => {
    const offset: Vec3 = [x, y, z]
    const cell = map3(base, (c, axis) => f(c + offset[axis]))
    return dot(
      cornerGradient(wrapCell(cell, period)),
      map3(local, (c, axis) => f(c - offset[axis])),
    )
  }
  const bottomFront = mix(corner(0, 0, 0), corner(1, 0, 0), fade[0])
  const topFront = mix(corner(0, 1, 0), corner(1, 1, 0), fade[0])
  const bottomBack = mix(corner(0, 0, 1), corner(1, 0, 1), fade[0])
  const topBack = mix(corner(0, 1, 1), corner(1, 1, 1), fade[0])
  return f(
    mix(mix(bottomFront, topFront, fade[1]), mix(bottomBack, topBack, fade[1]), fade[2]) *
      OUTPUT_SCALE,
  )
}

/** A deterministic LCG, so the sampled points are the same on every run. */
function randomPoints(count: number, span: number): Vec3[] {
  let state = 12345
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  return Array.from({ length: count }, (): Vec3 => [next() * span, next() * span, next() * span])
}

const POINTS = randomPoints(4096, 40)
const PERIOD: Vec3 = [6, 2, 0]

describe('the tiled noise (float32 mirror)', () => {
  it('reads the same value one period further along each tiled axis', () => {
    for (const point of POINTS) {
      const value = tiledNoise(point, PERIOD)
      const acrossX: Vec3 = [f(point[0] + PERIOD[0]), point[1], point[2]]
      const acrossY: Vec3 = [point[0], f(point[1] + PERIOD[1]), point[2]]
      expect(Math.abs(tiledNoise(acrossX, PERIOD) - value)).toBeLessThan(1e-4)
      expect(Math.abs(tiledNoise(acrossY, PERIOD) - value)).toBeLessThan(1e-4)
    }
  })

  it('leaves an axis with a period of 0 endless', () => {
    const changed = POINTS.filter((point) => {
      const further: Vec3 = [point[0], point[1], f(point[2] + 6)]
      return Math.abs(tiledNoise(further, PERIOD) - tiledNoise(point, PERIOD)) > 0.01
    })
    expect(changed.length).toBeGreaterThan(POINTS.length * 0.9)
  })

  it('spreads like a noise: around 0, within about ±1', () => {
    const values = POINTS.map((point) => tiledNoise(point, PERIOD))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const deviation = Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
    )
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(deviation).toBeGreaterThan(0.18)
    expect(deviation).toBeLessThan(0.4)
    expect(Math.max(...values.map(Math.abs))).toBeLessThan(1.2)
  })

  it('is 0 on every lattice point, like any gradient noise', () => {
    expect(tiledNoise([3, 1, 7], PERIOD)).toBe(0)
  })
})
