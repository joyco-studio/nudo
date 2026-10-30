import type { TslFacade } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { blackbodyColor, blackbodyNode } from './blackbody-node'

/**
 * A numeric facade for the ops the blackbody uses: floats and vec3s as plain arrays, evaluated on
 * the CPU, so the node's math can be checked against reference chromaticities.
 */
type Value = readonly number[]

const zip = (a: Value, b: Value, op: (x: number, y: number) => number): Value => {
  const length = Math.max(a.length, b.length)
  return Array.from({ length }, (_, index) =>
    op(a[a.length === 1 ? 0 : index] ?? 0, b[b.length === 1 ? 0 : index] ?? 0),
  )
}

/** Ops the blackbody never calls: reaching one fails the test. */
const unsupported = (): never => {
  throw new Error('Not used by the blackbody')
}

function numericFacade(): TslFacade<Value> {
  return {
    add: (a, b) => zip(a, b, (x, y) => x + y),
    sub: (a, b) => zip(a, b, (x, y) => x - y),
    mul: (a, b) => zip(a, b, (x, y) => x * y),
    div: (a, b) => zip(a, b, (x, y) => x / y),
    max: (a, b) => zip(a, b, Math.max),
    clamp: (x, low, high) => zip(zip(x, low, Math.max), high, Math.min),
    construct: (_type, parts) =>
      parts.flatMap((part) => (typeof part === 'number' ? [part] : part)),
    sin: unsupported,
    atan2: unsupported,
    cos: unsupported,
    abs: unsupported,
    fract: unsupported,
    floor: unsupported,
    min: unsupported,
    exp: unsupported,
    pow: unsupported,
    oneMinus: unsupported,
    dot: unsupported,
    length: unsupported,
    normalize: unsupported,
    distance: unsupported,
    reflect: unsupported,
    refract: unsupported,
    toneMap: unsupported,
    mix: unsupported,
    step: unsupported,
    smoothstep: unsupported,
    fwidth: unsupported,
    dFdx: unsupported,
    dFdy: unsupported,
    remap: unsupported,
    select: unsupported,
    noise: unsupported,
    tiledNoise: unsupported,
    voronoi: unsupported,
    voronoiCell: unsupported,
    voronoiMinkowski: unsupported,
    voronoiMinkowskiCell: unsupported,
    tiledVoronoi: unsupported,
    cellNoise: unsupported,
    hash: unsupported,
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

const color = (kelvin: number): Value => blackbodyColor(numericFacade(), [kelvin])

/** Linear sRGB back to CIE xy, to compare with published chromaticities. */
function chromaticity([red = 0, green = 0, blue = 0]: Value): readonly [number, number] {
  const x = 0.4124564 * red + 0.3575761 * green + 0.1804375 * blue
  const y = 0.2126729 * red + 0.7151522 * green + 0.072175 * blue
  const z = 0.0193339 * red + 0.119192 * green + 0.9503041 * blue
  const sum = x + y + z
  return [x / sum, y / sum]
}

describe('blackbody', () => {
  it('takes a temperature in kelvin, 1500 by default, and gives a vec3 color', () => {
    expect(blackbodyNode.inputs.map((input) => [input.id, input.default])).toEqual([
      ['temperature', { type: 'float', value: 1500 }],
    ])
    expect(blackbodyNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['color', { kind: 'concrete', type: 'vec3' }],
    ])
  })

  it('lands on CIE illuminant A at 2856 K', () => {
    const [x, y] = chromaticity(color(2856))
    expect(x).toBeCloseTo(0.4476, 2)
    expect(y).toBeCloseTo(0.4074, 2)
  })

  it('lands on the Planckian locus at 6500 K, a hair off D65', () => {
    const [x, y] = chromaticity(color(6500))
    expect(x).toBeCloseTo(0.3135, 2)
    expect(y).toBeCloseTo(0.3236, 2)
  })

  it('keeps its brightest channel at 1, so intensity is up to the user', () => {
    for (const kelvin of [1000, 1500, 3000, 6500, 12000]) {
      expect(Math.max(...color(kelvin)), String(kelvin)).toBeCloseTo(1, 6)
    }
  })

  it('glows deep red when cool and blue when very hot', () => {
    const [red1500 = 0, green1500 = 0, blue1500 = 0] = color(1500)
    expect(red1500).toBe(1)
    expect(green1500).toBeGreaterThan(0.1)
    expect(green1500).toBeLessThan(0.45)
    expect(blue1500).toBeLessThan(0.05)

    const [red12k = 0, , blue12k = 0] = color(12000)
    expect(blue12k).toBe(1)
    expect(red12k).toBeLessThan(0.9)
  })

  it('holds its color outside 1000 to 15000 K', () => {
    expect(color(500)).toEqual(color(1000))
    expect(color(40000)).toEqual(color(15000))
  })
})
