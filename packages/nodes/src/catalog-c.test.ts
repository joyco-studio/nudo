import type { AnyNodeDefinition, DataType, ParamValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_3_CATALOG_C,
  blendNode,
  createDefaultRegistry,
  createRecordingFacade,
  mainLightNode,
  moduloNode,
  posterizeNode,
  triplanarNode,
  voronoi3dNode,
  voronoiNode,
} from './index'

const CATALOG_C_TYPES = [
  'math/posterize',
  'math/modulo',
  'color/blend',
  'effects/voronoi-3d',
  'texture/triplanar',
  'input/main-light',
]

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
  const k = (n: number): string => `construct(float,[${String(n)}])`
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

describe('voronoi 3d', () => {
  const VORONOI_INPUTS = { position: 'p', scale: 'scale', jitter: 'jitter' }

  it('reads the cells around a 3D point with the same outputs as the 2D voronoi', () => {
    const cells = 'voronoi(mul(p,scale),jitter,euclidean)'
    const cell = 'voronoiCell(3,mul(p,scale),jitter,euclidean)'

    expect(buildWith(voronoi3dNode, VORONOI_INPUTS)).toEqual({
      f1: `swizzle(${cells},x)`,
      f2: `swizzle(${cells},y)`,
      edge: `sub(swizzle(${cells},y),swizzle(${cells},x))`,
      cell,
      random: `cellNoise(floor(${cell}))`,
    })
  })

  it('measures with the chosen distance', () => {
    expect(buildWith(voronoi3dNode, VORONOI_INPUTS, { distance: 'chebyshev' }).cell).toBe(
      'voronoiCell(3,mul(p,scale),jitter,chebyshev)',
    )
  })

  it('samples object position by default and outputs a vec3 cell', () => {
    expect(
      voronoi3dNode.inputs.map((input) => [input.id, input.type, input.default, input.fallback]),
    ).toEqual([
      [
        'position',
        { kind: 'concrete', type: 'vec3' },
        { type: 'vec3', value: [0, 0, 0] },
        'positionLocal',
      ],
      ['scale', { kind: 'concrete', type: 'float' }, { type: 'float', value: 5 }, undefined],
      ['jitter', { kind: 'concrete', type: 'float' }, { type: 'float', value: 1 }, undefined],
    ])
    expect(voronoi3dNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['f1', { kind: 'concrete', type: 'float' }],
      ['f2', { kind: 'concrete', type: 'float' }],
      ['edge', { kind: 'concrete', type: 'float' }],
      ['cell', { kind: 'concrete', type: 'vec3' }],
      ['random', { kind: 'concrete', type: 'float' }],
    ])
  })

  it('shares the distance param with the 2D voronoi', () => {
    expect(voronoi3dNode.params).toEqual(voronoiNode.params)
  })
})

describe('triplanar', () => {
  const TRIPLANAR_INPUTS = {
    texture: 'tex',
    position: 'p',
    normal: 'n',
    scale: 's',
    sharpness: 'k',
  }
  const sample = (a: string, b: string): string =>
    `textureSample(tex,mul(construct(vec2,[swizzle(p,${a}),swizzle(p,${b})]),s),null)`
  const powered = 'pow(abs(n),k)'
  const weights = `div(${powered},dot(${powered},construct(vec3,[1,1,1])))`

  it('blends three planar projections weighted by the normal', () => {
    const rgba = `add(add(mul(${sample('y', 'z')},swizzle(${weights},x)),mul(${sample('z', 'x')},swizzle(${weights},y))),mul(${sample('x', 'y')},swizzle(${weights},z)))`
    expect(buildWith(triplanarNode, TRIPLANAR_INPUTS)).toEqual({
      rgba,
      rgb: `swizzle(${rgba},xyz)`,
      a: `swizzle(${rgba},w)`,
    })
  })

  it('reads object position and normal by default', () => {
    expect(
      triplanarNode.inputs.map((input) => [input.id, input.type, input.default, input.fallback]),
    ).toEqual([
      [
        'texture',
        { kind: 'concrete', type: 'texture' },
        { type: 'texture', assetId: null },
        undefined,
      ],
      [
        'position',
        { kind: 'concrete', type: 'vec3' },
        { type: 'vec3', value: [0, 0, 0] },
        'positionLocal',
      ],
      [
        'normal',
        { kind: 'concrete', type: 'vec3' },
        { type: 'vec3', value: [0, 0, 1] },
        'normalLocal',
      ],
      ['scale', { kind: 'concrete', type: 'float' }, { type: 'float', value: 1 }, undefined],
      ['sharpness', { kind: 'concrete', type: 'float' }, { type: 'float', value: 1 }, undefined],
    ])
    expect(triplanarNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['rgba', { kind: 'concrete', type: 'vec4' }],
      ['rgb', { kind: 'concrete', type: 'vec3' }],
      ['a', { kind: 'concrete', type: 'float' }],
    ])
  })
})

describe('main light', () => {
  const direction = 'mainLight(direction)'
  const facing = `dot(normalize(n),${direction})`

  it('reads the shared light and shades the normal with Lambert and half-Lambert', () => {
    expect(buildWith(mainLightNode, { normal: 'n' })).toEqual({
      direction,
      color: 'mainLight(color)',
      lambert: `max(${facing},construct(float,[0]))`,
      halfLambert: `add(mul(${facing},construct(float,[0.5])),construct(float,[0.5]))`,
    })
  })

  it('reads the world normal by default and outputs vec3 light and float shading', () => {
    expect(
      mainLightNode.inputs.map((input) => [input.id, input.type, input.default, input.fallback]),
    ).toEqual([
      [
        'normal',
        { kind: 'concrete', type: 'vec3' },
        { type: 'vec3', value: [0, 0, 1] },
        'normalWorld',
      ],
    ])
    expect(mainLightNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['direction', { kind: 'concrete', type: 'vec3' }],
      ['color', { kind: 'concrete', type: 'vec3' }],
      ['lambert', { kind: 'concrete', type: 'float' }],
      ['halfLambert', { kind: 'concrete', type: 'float' }],
    ])
  })
})
