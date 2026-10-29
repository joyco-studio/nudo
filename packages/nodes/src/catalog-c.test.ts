import type { AnyNodeDefinition, DataType, ParamValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_3_CATALOG_C,
  blendNode,
  createDefaultRegistry,
  createRecordingFacade,
  moduloNode,
  posterizeNode,
} from './index'

const CATALOG_C_TYPES = ['math/posterize', 'math/modulo', 'color/blend']

const buildWith = (
  definition: AnyNodeDefinition,
  inputs: Readonly<Record<string, string>> = {},
  params: Readonly<Record<string, ParamValue>> = {},
  resolvedTypes: Readonly<Record<string, DataType>> = {},
  property: string | null = null,
): Readonly<Record<string, string>> =>
  definition.build({ tsl: createRecordingFacade(), inputs, resolvedTypes, params, property })

const registry = createDefaultRegistry()

describe('catalog C registration', () => {
  it('catalog-c types registered', () => {
    expect(PHASE_3_CATALOG_C.map((definition) => definition.type)).toEqual(CATALOG_C_TYPES)
    for (const type of CATALOG_C_TYPES) {
      expect(registry.get(type), type).toBeDefined()
    }
  })

  it('every definition has a description and keywords', () => {
    for (const definition of PHASE_3_CATALOG_C) {
      expect(definition.description.trim(), definition.type).not.toBe('')
      expect(definition.keywords.length, definition.type).toBeGreaterThan(0)
    }
  })
})

describe('posterize and modulo', () => {
  it('posterize floors In × Steps back to steps', () => {
    expect(buildWith(posterizeNode, { in: 'x', steps: 's' }).out).toBe('div(floor(mul(x,s)),s)')
  })

  it('modulo is floored, the same on WebGPU and WebGL', () => {
    // WGSL % truncates and GLSL mod floors: A − B × floor(A / B) agrees on both.
    expect(buildWith(moduloNode, { a: 'a', b: 'b' }).out).toBe('sub(a,mul(b,floor(div(a,b))))')
  })
})

describe('blend', () => {
  // The recording facade prints constants as construct(float,[n]).
  const k = (n: number): string => `construct(float,[${n}])`
  const BLEND_INPUTS = { base: 'a', blend: 'b', opacity: 'o' }

  const BLEND_EXPRESSIONS: readonly (readonly [string, string])[] = [
    ['multiply', 'mul(a,b)'],
    ['screen', 'oneMinus(mul(oneMinus(a),oneMinus(b)))'],
    [
      'overlay',
      `mix(mul(${k(2)},mul(a,b)),oneMinus(mul(${k(2)},mul(oneMinus(a),oneMinus(b)))),step(${k(0.5)},a))`,
    ],
    ['soft-light', `add(mul(sub(${k(1)},mul(${k(2)},b)),mul(a,a)),mul(${k(2)},mul(a,b)))`],
    ['linear-light', `sub(add(a,mul(${k(2)},b)),${k(1)})`],
    ['color-burn', `max(oneMinus(div(oneMinus(a),max(b,${k(0.00001)}))),${k(0)})`],
    ['color-dodge', `min(div(a,max(oneMinus(b),${k(0.00001)})),${k(1)})`],
    ['darken', 'min(a,b)'],
    ['lighten', 'max(a,b)'],
    ['difference', 'abs(sub(a,b))'],
    ['add', 'add(a,b)'],
    ['subtract', 'sub(a,b)'],
  ]

  it.each(BLEND_EXPRESSIONS)(
    '%s mixes the mode expression over Base by Opacity',
    (mode, expression) => {
      expect(buildWith(blendNode, BLEND_INPUTS, { mode }).out).toBe(`mix(a,${expression},o)`)
    },
  )

  it('offers exactly the twelve modes, multiply first', () => {
    const modeParam = blendNode.params?.find((param) => param.id === 'mode')
    expect(
      modeParam?.kind === 'enum' ? modeParam.options.map((option) => option.value) : [],
    ).toEqual(BLEND_EXPRESSIONS.map(([mode]) => mode))
  })

  it('falls back to multiply for an unknown or missing mode', () => {
    const multiplied = 'mix(a,mul(a,b),o)'
    expect(buildWith(blendNode, BLEND_INPUTS, { mode: 'burn-it-all' }).out).toBe(multiplied)
    expect(buildWith(blendNode, BLEND_INPUTS).out).toBe(multiplied)
  })
})
