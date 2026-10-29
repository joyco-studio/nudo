import {
  addNode,
  asEdgeId,
  asNodeId,
  connect,
  createGraph,
  portKey,
  resolvePortTypes,
  setParam,
  topologyKey,
} from '@nudo-tsl/core'
import type { AnyNodeDefinition, DataType, Graph, ParamValue, Result } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_3_CATALOG_C,
  blendNode,
  COLOR_RAMP_MAX_STOPS,
  COLOR_RAMP_MIN_STOPS,
  colorRampCount,
  colorRampNode,
  colorRampStopInputIds,
  createDefaultRegistry,
  createRecordingFacade,
  hashNode,
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
  'color/color-ramp',
  'math/hash',
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

describe('color ramp', () => {
  const k = (n: number): string => `construct(float,[${String(n)}])`
  const RAMP_INPUTS: Readonly<Record<string, string>> = {
    in: 'x',
    stop0Position: 'p0',
    stop0Color: 'c0',
    stop1Position: 'p1',
    stop1Color: 'c1',
    stop2Position: 'p2',
    stop2Color: 'c2',
    stop3Position: 'p3',
    stop3Color: 'c3',
  }
  const progress = (from: string, to: string): string =>
    `clamp(div(sub(x,${from}),max(sub(${to},${from}),${k(0.00001)})),${k(0)},${k(1)})`
  const smoothed = (t: string): string => `mul(mul(${t},${t}),sub(${k(3)},mul(${k(2)},${t})))`
  const ramp = (params: Readonly<Record<string, ParamValue>>): string | undefined =>
    buildWith(colorRampNode, RAMP_INPUTS, { count: 3, ...params }).out

  it('mixes each segment in turn by how far In has travelled along it', () => {
    const first = `mix(c0,c1,${progress('p0', 'p1')})`
    expect(ramp({})).toBe(`mix(${first},c2,${progress('p1', 'p2')})`)
  })

  it('eases each segment with smooth interpolation', () => {
    const first = `mix(c0,c1,${smoothed(progress('p0', 'p1'))})`
    expect(ramp({ interpolation: 'smooth' })).toBe(
      `mix(${first},c2,${smoothed(progress('p1', 'p2'))})`,
    )
  })

  it('switches color at each stop position with constant interpolation', () => {
    const first = 'mix(c0,c1,step(p1,x))'
    expect(ramp({ interpolation: 'constant' })).toBe(`mix(${first},c2,step(p2,x))`)
  })

  it('falls back to linear for an unknown interpolation', () => {
    expect(ramp({ interpolation: 'wobbly' })).toBe(ramp({}))
  })

  it('never reads a stop at or above the count', () => {
    const expression = ramp({})
    expect(expression).not.toContain('p3')
    expect(expression).not.toContain('c3')
  })

  it('guards equal positions against a division by zero', () => {
    expect(ramp({})).toContain(`max(sub(p1,p0),${k(0.00001)})`)
  })

  it('a two-stop ramp is one mix from the first color to the second', () => {
    expect(ramp({ count: 2 })).toBe(`mix(c0,c1,${progress('p0', 'p1')})`)
  })

  it('names the inputs of a stop', () => {
    expect(colorRampStopInputIds(3)).toEqual({ position: 'stop3Position', color: 'stop3Color' })
  })

  it('clamps and rounds the stop count, defaulting to two', () => {
    expect(COLOR_RAMP_MAX_STOPS).toBe(8)
    expect(COLOR_RAMP_MIN_STOPS).toBe(2)
    expect(colorRampCount({})).toBe(2)
    expect(colorRampCount({ count: 0 })).toBe(2)
    expect(colorRampCount({ count: 99 })).toBe(8)
    expect(colorRampCount({ count: 4.6 })).toBe(5)
    expect(colorRampCount({ count: 'many' })).toBe(2)
    expect(colorRampCount({ count: Number.NaN })).toBe(2)
  })

  it('declares In plus a position and a color for each of the eight stops', () => {
    expect(colorRampNode.inputs).toHaveLength(1 + 2 * COLOR_RAMP_MAX_STOPS)
    expect(
      colorRampNode.inputs.map((input) => [input.id, input.type, input.default, input.widget]),
    ).toEqual([
      ['in', { kind: 'concrete', type: 'float' }, { type: 'float', value: 0.5 }, undefined],
      ...Array.from({ length: COLOR_RAMP_MAX_STOPS }, (_, index) => {
        const isFirst = index === 0
        const ids = colorRampStopInputIds(index)
        return [
          [
            ids.position,
            { kind: 'concrete', type: 'float' },
            { type: 'float', value: isFirst ? 0 : 1 },
            undefined,
          ],
          [
            ids.color,
            { kind: 'concrete', type: 'vec3' },
            { type: 'vec3', value: isFirst ? [0, 0, 0] : [1, 1, 1] },
            'color',
          ],
        ]
      }).flat(),
    ])
    expect(colorRampNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['out', { kind: 'concrete', type: 'vec3' }],
    ])
  })

  it('hides the stops at or above the count', () => {
    const hiddenIds = (params: Readonly<Record<string, ParamValue>>): string[] =>
      colorRampNode.inputs
        .filter((input) => input.hiddenWhen?.(params) === true)
        .map((input) => input.id)

    expect(hiddenIds({})).toHaveLength(2 * (COLOR_RAMP_MAX_STOPS - 2))
    expect(hiddenIds({ count: 3 })).not.toContain('stop2Color')
    expect(hiddenIds({ count: 3 })).toContain('stop3Position')
    expect(hiddenIds({ count: 8 })).toEqual([])
    expect(hiddenIds({ count: 2 })).not.toContain('in')
  })

  it('changing the count changes the topology key, so every preview recompiles', () => {
    const unwrap = <T, E>(result: Result<T, E>): T => {
      if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
      return result.value
    }
    const rampId = asNodeId('ramp')
    const graph: Graph = unwrap(
      addNode(createGraph(), registry, {
        id: rampId,
        type: 'color/color-ramp',
        position: { x: 0, y: 0 },
      }),
    )
    const threeStops = unwrap(setParam(graph, registry, { nodeId: rampId, paramId: 'count' }, 3))

    expect(topologyKey(threeStops, registry)).not.toBe(topologyKey(graph, registry))
  })

  it('stores the count as a hidden number param between two and eight', () => {
    expect(colorRampNode.params).toEqual([
      {
        id: 'count',
        label: 'Stops',
        kind: 'number',
        min: 2,
        max: 8,
        step: 1,
        default: 2,
        hidden: true,
      },
      {
        id: 'interpolation',
        label: 'Interpolation',
        kind: 'enum',
        options: [
          { value: 'linear', label: 'Linear' },
          { value: 'constant', label: 'Constant' },
          { value: 'smooth', label: 'Smooth' },
        ],
        default: 'linear',
      },
    ])
  })
})

describe('random hash', () => {
  const hashed = buildWith(hashNode, { in: 'p', seed: 's' })

  it('hashes the input with the seed, once for the float and once for the vec3', () => {
    expect(hashed).toEqual({ out: 'hash(float,p,s)', out3: 'hash(vec3,p,s)' })
  })

  it('reads the mesh UV when nothing is plugged in, with seed 0', () => {
    expect(
      hashNode.inputs.map((input) => [input.id, input.type, input.default, input.fallback]),
    ).toEqual([
      [
        'in',
        { kind: 'generic', group: 'T', allowed: ['float', 'vec2', 'vec3'] },
        { type: 'float', value: 0 },
        'uv',
      ],
      ['seed', { kind: 'concrete', type: 'float' }, { type: 'float', value: 0 }, undefined],
    ])
  })

  it('outputs a float and a vec3 whatever the input is', () => {
    expect(hashNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['out', { kind: 'concrete', type: 'float' }],
      ['out3', { kind: 'concrete', type: 'vec3' }],
    ])
  })

  it('is found by its artist-facing names', () => {
    expect(hashNode.label).toBe('Random')
    expect(hashNode.keywords).toEqual(expect.arrayContaining(['hash', 'random', 'white noise']))
  })

  it.each([
    ['input/float', 'float'],
    ['input/vector2', 'vec2'],
    ['input/vector3', 'vec3'],
  ] as const)('takes the type of a %s wired into In (%s)', (sourceType, expected) => {
    const unwrap = <T, E>(result: Result<T, E>): T => {
      if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
      return result.value
    }
    const origin = { x: 0, y: 0 }
    const withSource = unwrap(
      addNode(createGraph(), registry, {
        id: asNodeId('source'),
        type: sourceType,
        position: origin,
      }),
    )
    const withHash = unwrap(
      addNode(withSource, registry, { id: asNodeId('hash'), type: 'math/hash', position: origin }),
    )
    const wired = unwrap(
      connect(withHash, registry, {
        id: asEdgeId('source-to-hash'),
        from: { nodeId: asNodeId('source'), portId: 'out' },
        to: { nodeId: asNodeId('hash'), portId: 'in' },
      }),
    )

    const resolved = resolvePortTypes(wired, registry)

    expect(resolved.inputs.get(portKey({ nodeId: asNodeId('hash'), portId: 'in' }))).toBe(expected)
    expect(resolved.outputs.get(portKey({ nodeId: asNodeId('hash'), portId: 'out' }))).toBe('float')
    expect(resolved.outputs.get(portKey({ nodeId: asNodeId('hash'), portId: 'out3' }))).toBe('vec3')
  })

  it('reads the mesh UV as a vec2 when nothing is plugged in', () => {
    const added = addNode(createGraph(), registry, {
      id: asNodeId('hash'),
      type: 'math/hash',
      position: { x: 0, y: 0 },
    })
    if (!added.ok) throw new Error('Cannot add the hash')

    const resolved = resolvePortTypes(added.value, registry)

    expect(resolved.inputs.get(portKey({ nodeId: asNodeId('hash'), portId: 'in' }))).toBe('vec2')
  })

  it('refuses a vec4 in In, which has no hash', () => {
    const origin = { x: 0, y: 0 }
    const withSource = addNode(createGraph(), registry, {
      id: asNodeId('source'),
      type: 'input/vector4',
      position: origin,
    })
    if (!withSource.ok) throw new Error('Cannot add the vec4 source')
    const withHash = addNode(withSource.value, registry, {
      id: asNodeId('hash'),
      type: 'math/hash',
      position: origin,
    })
    if (!withHash.ok) throw new Error('Cannot add the hash')

    const wired = connect(withHash.value, registry, {
      id: asEdgeId('source-to-hash'),
      from: { nodeId: asNodeId('source'), portId: 'out' },
      to: { nodeId: asNodeId('hash'), portId: 'in' },
    })

    expect(wired.ok).toBe(false)
  })
})
