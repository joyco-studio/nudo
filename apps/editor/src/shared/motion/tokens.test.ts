// @vitest-environment node
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { BLUR_PX, DISTANCE_PX, DURATION_MS, EASE, SCALE } from './tokens'
import type { Ease } from './tokens'

// Read from disk (Vitest stubs CSS modules, `?raw` included), hence the node environment.
const motionTokensCss = readFileSync(new URL('./motion-tokens.css', import.meta.url), 'utf8')

/** The CSS keywords the token sheet uses, as the cubic-bezier curves the browser runs for them. */
const CSS_EASE_KEYWORDS: Readonly<Record<string, Ease>> = {
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  linear: 'linear',
}

function cssToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(motionTokensCss)
  if (match?.[1] === undefined) throw new Error(`--${name} is missing from motion-tokens.css`)
  return match[1].trim()
}

function cssEase(name: string): Ease {
  const value = cssToken(name)
  const keyword = CSS_EASE_KEYWORDS[value]
  if (keyword !== undefined) return keyword
  const bezier = /^cubic-bezier\(([^)]+)\)$/.exec(value)
  if (bezier?.[1] === undefined) throw new Error(`--${name} is not a curve: ${value}`)
  const points = bezier[1].split(',').map(Number)
  const [x1, y1, x2, y2] = points
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    throw new Error(`--${name} needs four control points: ${value}`)
  }
  return [x1, y1, x2, y2]
}

describe('motion tokens (transitions.dev scale, ruling P2-R12)', () => {
  it('has the exact durations', () => {
    expect(DURATION_MS).toEqual({
      stagger: 40,
      micro: 80,
      quick: 150,
      fast: 250,
      medium: 350,
      slow: 400,
      verySlow: 500,
    })
  })

  it('has the exact easings', () => {
    expect(EASE).toEqual({
      smoothOut: [0.22, 1, 0.36, 1],
      inOut: [0.42, 0, 0.58, 1],
      out: [0, 0, 0.58, 1],
      linear: 'linear',
      bounce: [0.34, 1.36, 0.64, 1],
      bounceStrong: [0.34, 3.85, 0.64, 1],
    })
  })

  it('has the exact distances, scales and blurs', () => {
    expect(DISTANCE_PX).toEqual({ micro: 4, small: 6, base: 8, medium: 12, large: 30 })
    expect(SCALE).toEqual({ large: 0.96, medium: 0.97, small: 0.98, tiny: 0.99 })
    expect(BLUR_PX).toEqual({ small: 2, medium: 3, large: 8 })
  })

  it('mirrors the CSS token sheet value for value', () => {
    expect(cssToken('duration-stagger')).toBe(`${String(DURATION_MS.stagger)}ms`)
    expect(cssToken('duration-micro')).toBe(`${String(DURATION_MS.micro)}ms`)
    expect(cssToken('duration-quick')).toBe(`${String(DURATION_MS.quick)}ms`)
    expect(cssToken('duration-fast')).toBe(`${String(DURATION_MS.fast)}ms`)
    expect(cssToken('duration-medium')).toBe(`${String(DURATION_MS.medium)}ms`)
    expect(cssToken('duration-slow')).toBe(`${String(DURATION_MS.slow)}ms`)
    expect(cssToken('duration-very-slow')).toBe(`${String(DURATION_MS.verySlow)}ms`)

    expect(cssEase('ease-smooth-out')).toEqual(EASE.smoothOut)
    expect(cssEase('ease-in-out')).toEqual(EASE.inOut)
    expect(cssEase('ease-out')).toEqual(EASE.out)
    expect(cssEase('ease-linear')).toEqual(EASE.linear)
    expect(cssEase('ease-bounce')).toEqual(EASE.bounce)
    expect(cssEase('ease-bounce-strong')).toEqual(EASE.bounceStrong)

    expect(cssToken('distance-micro')).toBe(`${String(DISTANCE_PX.micro)}px`)
    expect(cssToken('distance-small')).toBe(`${String(DISTANCE_PX.small)}px`)
    expect(cssToken('distance-base')).toBe(`${String(DISTANCE_PX.base)}px`)
    expect(cssToken('distance-medium')).toBe(`${String(DISTANCE_PX.medium)}px`)
    expect(cssToken('distance-large')).toBe(`${String(DISTANCE_PX.large)}px`)

    expect(Number(cssToken('scale-large'))).toBe(SCALE.large)
    expect(Number(cssToken('scale-medium'))).toBe(SCALE.medium)
    expect(Number(cssToken('scale-small'))).toBe(SCALE.small)
    expect(Number(cssToken('scale-tiny'))).toBe(SCALE.tiny)

    expect(cssToken('blur-small')).toBe(`${String(BLUR_PX.small)}px`)
    expect(cssToken('blur-medium')).toBe(`${String(BLUR_PX.medium)}px`)
    expect(cssToken('blur-large')).toBe(`${String(BLUR_PX.large)}px`)
  })
})
