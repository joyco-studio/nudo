import { describe, expect, it } from 'vitest'
import type { VectorType } from '../types/data-type'
import type { BuiltinName, NoiseKind } from '../types/tsl-facade'
import { OUTLINE_SLOTS } from '../compiler/compile-backend'
import {
  OUTLINE_WOBBLE_FREQUENCY,
  OUTLINE_WOBBLE_SPEED,
  outlineMaterialAssignments,
} from './master-outline'
import { DEFAULT_MASTER_SETTINGS, masterMaterialAssignments } from './master-settings'

/** Prints each call, so an expression reads as the TSL it stands for. */
const tsl = {
  add: (a: string, b: string) => `add(${a},${b})`,
  mul: (a: string, b: string) => `mul(${a},${b})`,
  div: (a: string, b: string) => `div(${a},${b})`,
  max: (a: string, b: string) => `max(${a},${b})`,
  noise: (kind: NoiseKind, p: string) => `noise:${kind}(${p})`,
  builtin: (name: BuiltinName) => name,
  construct: (type: VectorType, parts: readonly (string | number)[]) =>
    `${type}(${parts.join(',')})`,
}

const OUTLINED = { ...DEFAULT_MASTER_SETTINGS, outline: true }
const slots = { baseColor: 'c', outlineWidth: 'w', outlineColor: 'k', outlineWobble: 'v' }
const WOBBLE_POINT = [
  `add(mul(mul(positionLocal,modelScale),float(${String(OUTLINE_WOBBLE_FREQUENCY)})),`,
  `mul(time,float(${String(OUTLINE_WOBBLE_SPEED)})))`,
].join('')
const THICKNESS = `add(w,mul(v,noise:perlin(${WOBBLE_POINT})))`
const PUSHED_OUT = `div(mul(normalLocal,max(${THICKNESS},float(0))),modelScale)`

describe('outlineMaterialAssignments', () => {
  it('assigns nothing while the outline is off', () => {
    expect(outlineMaterialAssignments(tsl, slots, DEFAULT_MASTER_SETTINGS)).toEqual([])
  })

  it('pushes each vertex out along its normal by the wobbled width, over the world scale', () => {
    expect(outlineMaterialAssignments(tsl, slots, OUTLINED)).toEqual([
      { property: 'positionNode', expression: `add(positionLocal,${PUSHED_OUT})` },
      { property: 'colorNode', expression: 'k' },
    ])
  })

  it('starts from the displaced position when the master has one', () => {
    const [position] = outlineMaterialAssignments(tsl, { ...slots, position: 'p' }, OUTLINED)

    expect(position).toEqual({ property: 'positionNode', expression: `add(p,${PUSHED_OUT})` })
  })

  it('cuts the hull with the surface alpha clip, so holes show no ink', () => {
    const clipped = { ...slots, opacity: 'o', alphaClip: 'a' }

    expect(outlineMaterialAssignments(tsl, clipped, OUTLINED).slice(2)).toEqual([
      { property: 'opacityNode', expression: 'o' },
      { property: 'alphaTestNode', expression: 'a' },
    ])
  })

  it('keeps the hull solid while no alpha clip is wired, whatever the opacity', () => {
    const properties = outlineMaterialAssignments(tsl, { ...slots, opacity: 'o' }, OUTLINED).map(
      ({ property }) => property,
    )

    expect(properties).toEqual(['positionNode', 'colorNode'])
  })

  it('assigns nothing when an outline slot did not compile', () => {
    expect(outlineMaterialAssignments(tsl, { outlineWidth: 'w' }, OUTLINED)).toEqual([])
    expect(
      outlineMaterialAssignments(tsl, { outlineWidth: 'w', outlineColor: 'k' }, OUTLINED),
    ).toEqual([])
  })

  it('keeps the outline slots off the surface material', () => {
    const surface = masterMaterialAssignments(tsl, slots, OUTLINED)

    expect(surface).toEqual([{ property: 'colorNode', expression: 'c' }])
    expect(OUTLINE_SLOTS).toEqual(['outlineWidth', 'outlineColor', 'outlineWobble'])
  })
})
