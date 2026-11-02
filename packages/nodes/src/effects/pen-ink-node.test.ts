import type { TslFacade } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { penInk } from './pen-ink-node'

/** Floats as plain numbers, evaluated on the CPU; the paper point is only read by noise and hash. */
type Value = number

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Ops the pen never calls: reaching one fails the test. */
const unsupported = (): never => {
  throw new Error('Not used by the pen')
}

/** A facade for the ops the pen uses, with the flow noise and the tooth hash pinned to values. */
function numericFacade(flowNoise: number, toothHash: number): TslFacade<Value> {
  return {
    add: (a, b) => a + b,
    sub: (a, b) => a - b,
    mul: (a, b) => a * b,
    max: (a, b) => Math.max(a, b),
    exp: (a) => Math.exp(a),
    floor: (a) => Math.floor(a),
    oneMinus: (a) => 1 - a,
    clamp: (x, low, high) => Math.min(high, Math.max(low, x)),
    mix: (a, b, t) => a + (b - a) * t,
    smoothstep,
    construct: (_type, parts) => Number(parts[0]),
    noise: () => flowNoise,
    hash: () => toothHash,
    div: unsupported,
    sin: unsupported,
    atan2: unsupported,
    cos: unsupported,
    abs: unsupported,
    fract: unsupported,
    min: unsupported,
    pow: unsupported,
    dot: unsupported,
    length: unsupported,
    normalize: unsupported,
    distance: unsupported,
    reflect: unsupported,
    refract: unsupported,
    toneMap: unsupported,
    step: unsupported,
    fwidth: unsupported,
    dFdx: unsupported,
    dFdy: unsupported,
    remap: unsupported,
    select: unsupported,
    tiledNoise: unsupported,
    voronoi: unsupported,
    voronoiCell: unsupported,
    voronoiMinkowski: unsupported,
    voronoiMinkowskiCell: unsupported,
    tiledVoronoi: unsupported,
    cellNoise: unsupported,
    checker: unsupported,
    textureSample: unsupported,
    colorSpace: unsupported,
    sceneColor: unsupported,
    sceneDepthFade: unsupported,
    normalFromHeight: unsupported,
    mainLight: unsupported,
    builtin: unsupported,
    swizzle: unsupported,
  }
}

interface Stroke {
  readonly distance: number
  readonly pressure: number
  /** Raw Perlin, -1…1. */
  readonly flow?: number
  /** Raw hash, 0…1. */
  readonly tooth?: number
}

const ink = ({ distance, pressure, flow = 1, tooth = 1 }: Stroke): number =>
  penInk(numericFacade(flow, tooth), {
    distance,
    pressure,
    paper: 0,
    flowScale: 1,
    toothScale: 1,
  })

describe('pen ink', () => {
  it('covers the center line fully where the ink runs wet on raised tooth', () => {
    expect(ink({ distance: 0, pressure: 1 })).toBeCloseTo(1)
  })

  it('leaves the paper clean past the stroke edge', () => {
    expect(ink({ distance: 1.01, pressure: 1 })).toBe(0)
    expect(ink({ distance: 1.01, pressure: 0.01 })).toBe(0)
  })

  it('thins and pales the line where the ink runs dry', () => {
    // A dry flow narrows the line to 0.68 and darkens it to 0.7 of the ink.
    expect(ink({ distance: 0, pressure: 1, flow: -1 })).toBeCloseTo(0.7)
    expect(ink({ distance: 0.7, pressure: 1, flow: -1 })).toBe(0)
    expect(ink({ distance: 0.7, pressure: 1, flow: 1 })).toBeGreaterThan(0)
  })

  it('specks the line with paper tooth without breaking it', () => {
    expect(ink({ distance: 0, pressure: 1, tooth: 0 })).toBeCloseTo(0.65)
  })

  it('spreads into a faint Gaussian smudge under light pressure', () => {
    const pressure = 0.01
    const center = ink({ distance: 0, pressure })
    const halfway = ink({ distance: 0.5, pressure })
    const smudge = (d: number): number => (Math.exp(-4 * d * d) - Math.exp(-4)) * pressure
    expect(center).toBeCloseTo(smudge(0))
    expect(halfway).toBeCloseTo(smudge(0.5))
    expect(halfway).toBeLessThan(center)
  })

  it('keeps the coverage within 0…1 when pressed past 1', () => {
    expect(ink({ distance: 0, pressure: 3 })).toBe(1)
  })
})
