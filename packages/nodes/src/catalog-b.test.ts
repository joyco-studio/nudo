import {
  addNode,
  asNodeId,
  compile,
  createGraph,
  parseGraph,
  serializeGraph,
  setParam,
  topologyKey,
} from '@nudo-tsl/core'
import type {
  AnyNodeDefinition,
  CompileBackend,
  DataType,
  Graph,
  ParamValue,
  Result,
} from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_2_CATALOG_B,
  checkerboardNode,
  colorSpaceNode,
  commentNode,
  createDefaultRegistry,
  createRecordingFacade,
  depthFadeNode,
  fresnelNode,
  gradientNode,
  noiseNode,
  normalFromHeightNode,
  positionNode,
  sampleTexture2dNode,
  sceneColorNode,
  timeNode,
  voronoiNode,
} from './index'

const CATALOG_B_TYPES = [
  'input/vector2',
  'input/vector3',
  'input/vector4',
  'input/position',
  'input/view-direction',
  'input/screen-uv',
  'input/camera-position',
  'property/float',
  'property/vec2',
  'property/vec3',
  'property/vec4',
  'property/texture',
  'effects/noise',
  'effects/voronoi',
  'effects/checkerboard',
  'effects/gradient',
  'texture/sample-texture-2d',
  'color/color-space',
  'scene/scene-color',
  'scene/depth-fade',
  'normal/normal-from-height',
  'utility/comment',
  'utility/reroute',
]

const buildWith = (
  definition: AnyNodeDefinition,
  inputs: Readonly<Record<string, string>> = {},
  params: Readonly<Record<string, ParamValue>> = {},
  resolvedTypes: Readonly<Record<string, DataType>> = {},
  property: string | null = null,
): Readonly<Record<string, string>> =>
  definition.build({ tsl: createRecordingFacade(), inputs, resolvedTypes, params, property })

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const registry = createDefaultRegistry()

const requireDefinition = (type: string): AnyNodeDefinition => {
  const definition = registry.get(type)
  if (definition === undefined) throw new Error(`Missing definition: ${type}`)
  return definition
}

describe('catalog B registration', () => {
  it('catalog-b types registered', () => {
    expect(PHASE_2_CATALOG_B.map((definition) => definition.type)).toEqual(CATALOG_B_TYPES)
    for (const type of CATALOG_B_TYPES) {
      expect(registry.get(type), type).toBeDefined()
    }
  })

  it('every definition has a description and keywords', () => {
    for (const definition of PHASE_2_CATALOG_B) {
      expect(definition.description.trim(), definition.type).not.toBe('')
      expect(definition.keywords.length, definition.type).toBeGreaterThan(0)
    }
  })

  it('files nodes under the new categories', () => {
    expect(requireDefinition('logic/select').category).toBe('logic')
    expect(requireDefinition('color/color-space').category).toBe('color')
    expect(requireDefinition('scene/scene-color').category).toBe('scene')
    expect(requireDefinition('scene/depth-fade').category).toBe('scene')
    expect(requireDefinition('normal/normal-from-height').category).toBe('normal')
    expect(requireDefinition('utility/comment').category).toBe('utility')
  })
})

describe('input nodes', () => {
  it.each([
    ['input/vector2', 'vec2'],
    ['input/vector3', 'vec3'],
    ['input/vector4', 'vec4'],
  ] as const)('%s passes its %s value through', (type, vectorType) => {
    const definition = requireDefinition(type)

    expect(buildWith(definition, { value: 'v' })).toEqual({ out: 'v' })
    expect(definition.inputs.map((input) => [input.id, input.type])).toEqual([
      ['value', { kind: 'concrete', type: vectorType }],
    ])
    expect(definition.outputs.map((output) => output.type)).toEqual([
      { kind: 'concrete', type: vectorType },
    ])
  })

  it('position reads the builtin of the chosen space, object by default', () => {
    expect(buildWith(positionNode).out).toBe('builtin(positionLocal)')
    expect(buildWith(positionNode, {}, { space: 'object' }).out).toBe('builtin(positionLocal)')
    expect(buildWith(positionNode, {}, { space: 'world' }).out).toBe('builtin(positionWorld)')
    expect(buildWith(positionNode, {}, { space: 'view' }).out).toBe('builtin(positionView)')
    expect(buildWith(positionNode, {}, { space: 'nope' }).out).toBe('builtin(positionLocal)')
  })

  it.each([
    ['input/view-direction', 'vec3', 'positionViewDirection'],
    ['input/screen-uv', 'vec2', 'screenUV'],
    ['input/camera-position', 'vec3', 'cameraPosition'],
  ] as const)('%s outputs a %s builtin', (type, outputType, builtin) => {
    const definition = requireDefinition(type)

    expect(buildWith(definition)).toEqual({ out: `builtin(${builtin})` })
    expect(definition.inputs).toEqual([])
    expect(definition.outputs.map((output) => output.type)).toEqual([
      { kind: 'concrete', type: outputType },
    ])
  })

  it('time keeps out as its primary output and adds sine, cosine and delta time', () => {
    expect(timeNode.outputs.map((output) => output.id)).toEqual([
      'out',
      'sineTime',
      'cosineTime',
      'deltaTime',
    ])
    expect(buildWith(timeNode)).toEqual({
      out: 'builtin(time)',
      sineTime: 'sin(builtin(time))',
      cosineTime: 'cos(builtin(time))',
      deltaTime: 'builtin(deltaTime)',
    })
  })
})

describe('property nodes', () => {
  it.each(['float', 'vec2', 'vec3', 'vec4', 'texture'] as const)(
    'property/%s reads a property through a hidden propertyId param',
    (type) => {
      const definition = requireDefinition(`property/${type}`)

      expect(definition.reads).toBe('property')
      expect(definition.inputs).toEqual([])
      expect(definition.outputs).toMatchObject([
        { id: 'out', label: 'Out', type: { kind: 'concrete', type } },
      ])
      expect(definition.params).toEqual([
        { id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true },
      ])
    },
  )

  it('property node outputs ctx.property', () => {
    expect(buildWith(requireDefinition('property/vec3'), {}, {}, {}, 'prop(tint)')).toEqual({
      out: 'prop(tint)',
    })
  })

  it('property node without a property fails to build', () => {
    expect(() => buildWith(requireDefinition('property/float'))).toThrow(/property/i)
  })
})

describe('effects nodes', () => {
  it('noise scales the point and defaults to simplex', () => {
    expect(buildWith(noiseNode, { p: 'p', scale: 's' }).out).toBe('noise(simplex,mul(p,s))')
    expect(buildWith(noiseNode, { p: 'p', scale: 's' }, { kind: 'perlin' }).out).toBe(
      'noise(perlin,mul(p,s))',
    )
    expect(buildWith(noiseNode, { p: 'p', scale: 's' }, { kind: 'nope' }).out).toBe(
      'noise(simplex,mul(p,s))',
    )
  })

  it('noise declares kind and octaves, a vec3 point at zero, a scale of 1, roughness and lacunarity', () => {
    expect(noiseNode.inputs.map((input) => [input.id, input.default])).toEqual([
      ['p', { type: 'vec3', value: [0, 0, 0] }],
      ['scale', { type: 'float', value: 1 }],
      ['roughness', { type: 'float', value: 0.5 }],
      ['lacunarity', { type: 'float', value: 2 }],
    ])
    expect(noiseNode.params).toEqual([
      {
        id: 'kind',
        label: 'Kind',
        kind: 'enum',
        options: [
          { value: 'perlin', label: 'Perlin' },
          { value: 'simplex', label: 'Simplex' },
        ],
        default: 'simplex',
      },
      { id: 'octaves', label: 'Octaves', kind: 'number', default: 1, min: 1, max: 8, step: 1 },
    ])
  })

  describe('noise octaves', () => {
    const inputs = { p: 'p', scale: 's', roughness: 'r', lacunarity: 'l' }
    const single = 'noise(simplex,mul(p,s))'
    const octave = (index: number): string =>
      `mul(noise(simplex,mul(mul(p,s),pow(l,construct(float,[${String(index)}])))),pow(r,construct(float,[${String(index)}])))`

    it('is exactly the single noise call with one octave or none stored', () => {
      expect(buildWith(noiseNode, inputs).out).toBe(single)
      expect(buildWith(noiseNode, inputs, { octaves: 1 }).out).toBe(single)
    })

    it('sums octaves at scale times lacunarity to the i, weighted by roughness to the i', () => {
      const sum = `add(add(${single},${octave(1)}),${octave(2)})`
      const amplitudes =
        'add(add(construct(float,[1]),pow(r,construct(float,[1]))),pow(r,construct(float,[2])))'
      expect(buildWith(noiseNode, inputs, { octaves: 3 }).out).toBe(`div(${sum},${amplitudes})`)
    })

    it('rounds a fractional octave count', () => {
      expect(buildWith(noiseNode, inputs, { octaves: 1.4 }).out).toBe(single)
      expect(buildWith(noiseNode, inputs, { octaves: 2.6 })).toEqual(
        buildWith(noiseNode, inputs, { octaves: 3 }),
      )
    })

    it('clamps the octave count to 1 through 8', () => {
      expect(buildWith(noiseNode, inputs, { octaves: 0 }).out).toBe(single)
      expect(buildWith(noiseNode, inputs, { octaves: -4 }).out).toBe(single)
      expect(buildWith(noiseNode, inputs, { octaves: 12 })).toEqual(
        buildWith(noiseNode, inputs, { octaves: 8 }),
      )
    })

    it('ignores a stored octave count that is not a number', () => {
      expect(buildWith(noiseNode, inputs, { octaves: 'many' }).out).toBe(single)
    })
  })

  describe('voronoi', () => {
    const VORONOI_INPUTS = { uv: 'uv', scale: 'scale', jitter: 'jitter' }

    it('keeps f1, f2 and edge as before, Euclidean when no distance is stored', () => {
      const outputs = buildWith(voronoiNode, VORONOI_INPUTS)
      const cells = 'voronoi(mul(uv,scale),jitter,euclidean)'

      expect(outputs).toMatchObject({
        f1: `swizzle(${cells},x)`,
        f2: `swizzle(${cells},y)`,
        edge: `sub(swizzle(${cells},y),swizzle(${cells},x))`,
      })
    })

    it('outputs the nearest cell point and a random value per cell', () => {
      const outputs = buildWith(voronoiNode, VORONOI_INPUTS)
      const cell = 'voronoiCell(2,mul(uv,scale),jitter,euclidean)'

      expect(outputs.cell).toBe(cell)
      expect(outputs.random).toBe(`cellNoise(floor(${cell}))`)
      expect(voronoiNode.outputs.map((output) => [output.id, output.type])).toEqual([
        ['f1', { kind: 'concrete', type: 'float' }],
        ['f2', { kind: 'concrete', type: 'float' }],
        ['edge', { kind: 'concrete', type: 'float' }],
        ['cell', { kind: 'concrete', type: 'vec2' }],
        ['random', { kind: 'concrete', type: 'float' }],
      ])
    })

    it.each(['manhattan', 'chebyshev'] as const)(
      'measures F1, F2 and the cell with the %s distance',
      (distance) => {
        const outputs = buildWith(voronoiNode, VORONOI_INPUTS, { distance })

        expect(outputs.f1).toBe(`swizzle(voronoi(mul(uv,scale),jitter,${distance}),x)`)
        expect(outputs.cell).toBe(`voronoiCell(2,mul(uv,scale),jitter,${distance})`)
      },
    )

    it('falls back to Euclidean for an unknown distance', () => {
      expect(buildWith(voronoiNode, VORONOI_INPUTS, { distance: 'taxicab' }).f1).toBe(
        'swizzle(voronoi(mul(uv,scale),jitter,euclidean),x)',
      )
    })

    it('offers the three distances, Euclidean by default', () => {
      expect(voronoiNode.params).toEqual([
        {
          id: 'distance',
          label: 'Distance',
          kind: 'enum',
          options: [
            { value: 'euclidean', label: 'Euclidean' },
            { value: 'manhattan', label: 'Manhattan' },
            { value: 'chebyshev', label: 'Chebyshev' },
          ],
          default: 'euclidean',
        },
      ])
    })

    it('keeps its UV input a concrete vec2', () => {
      expect(voronoiNode.inputs.find((input) => input.id === 'uv')?.type).toEqual({
        kind: 'concrete',
        type: 'vec2',
      })
    })
  })

  it('checkerboard scales the uv', () => {
    expect(buildWith(checkerboardNode, { uv: 'uv', scale: 's' }).out).toBe('checker(mul(uv,s))')
  })

  it('gradient linear modes read a uv component and default to linear-x', () => {
    expect(buildWith(gradientNode, { uv: 'uv' }).out).toBe('swizzle(uv,x)')
    expect(buildWith(gradientNode, { uv: 'uv' }, { mode: 'linear-x' }).out).toBe('swizzle(uv,x)')
    expect(buildWith(gradientNode, { uv: 'uv' }, { mode: 'linear-y' }).out).toBe('swizzle(uv,y)')
  })

  it('gradient radial formula', () => {
    expect(buildWith(gradientNode, { uv: 'uv' }, { mode: 'radial' }).out).toBe(
      'clamp(mul(length(sub(uv,construct(float,[0.5]))),construct(float,[2])),' +
        'construct(float,[0]),construct(float,[1]))',
    )
  })

  it('fresnel uses its normal and view direction inputs', () => {
    expect(buildWith(fresnelNode, { normal: 'n', viewDir: 'v', power: 'p' }).out).toBe(
      'pow(oneMinus(clamp(dot(n,v),construct(float,[0]),construct(float,[1]))),p)',
    )
  })

  it('fresnel keeps power and out and falls back to the view normal and direction', () => {
    expect(fresnelNode.inputs.map((input) => [input.id, input.fallback])).toEqual([
      ['normal', 'normalView'],
      ['viewDir', 'positionViewDirection'],
      ['power', undefined],
    ])
    expect(fresnelNode.outputs.map((output) => output.id)).toEqual(['out'])
  })
})

describe('texture, color, scene and normal nodes', () => {
  const samplerInputs = { texture: 't', uv: 'uv', level: 'lod' }

  it('sample-texture-2d samples with automatic mips by default', () => {
    expect(buildWith(sampleTexture2dNode, samplerInputs)).toEqual({
      rgba: 'textureSample(t,uv,null)',
      rgb: 'swizzle(textureSample(t,uv,null),xyz)',
      a: 'swizzle(textureSample(t,uv,null),w)',
    })
  })

  it('sample-texture-2d samples the given level when mip is level', () => {
    expect(buildWith(sampleTexture2dNode, samplerInputs, { mip: 'level' }).rgba).toBe(
      'textureSample(t,uv,lod)',
    )
  })

  it('sample-texture-2d has an empty texture default and a mesh uv fallback', () => {
    expect(
      sampleTexture2dNode.inputs.map((input) => [input.id, input.default, input.fallback]),
    ).toEqual([
      ['texture', { type: 'texture', assetId: null }, undefined],
      ['uv', { type: 'vec2', value: [0, 0] }, 'uv'],
      ['level', { type: 'float', value: 0 }, undefined],
    ])
  })

  it('color-space converts in the chosen direction', () => {
    expect(buildWith(colorSpaceNode, { in: 'c' }, { direction: 'srgb-to-linear' }).out).toBe(
      'colorSpace(srgb-to-linear,c)',
    )
    expect(buildWith(colorSpaceNode, { in: 'c' }, { direction: 'linear-to-srgb' }).out).toBe(
      'colorSpace(linear-to-srgb,c)',
    )
  })

  it('scene-color samples the scene at the uv plus the offset', () => {
    expect(buildWith(sceneColorNode, { uv: 'uv', offset: 'o' }).out).toBe('sceneColor(add(uv,o))')
    expect(sceneColorNode.inputs.find((input) => input.id === 'uv')?.fallback).toBe('screenUV')
  })

  it('depth-fade and normal-from-height delegate to the facade', () => {
    expect(buildWith(depthFadeNode, { distance: 'd' }).out).toBe('sceneDepthFade(d)')
    expect(buildWith(normalFromHeightNode, { height: 'h', strength: 's' }).out).toBe(
      'normalFromHeight(h,s)',
    )
  })
})

describe('comment node', () => {
  it('comment node has no ports', () => {
    expect(commentNode.inputs).toEqual([])
    expect(commentNode.outputs).toEqual([])
    expect(buildWith(commentNode)).toEqual({})
  })

  it('hides the title, the size and the body text: the editor edits them, and they never recompile', () => {
    expect(commentNode.params).toEqual([
      {
        id: 'title',
        label: 'Title',
        kind: 'string',
        default: 'Comment',
        hidden: true,
        editorOnly: true,
      },
      {
        id: 'width',
        label: 'Width',
        kind: 'number',
        default: 320,
        min: 120,
        hidden: true,
        editorOnly: true,
      },
      {
        id: 'height',
        label: 'Height',
        kind: 'number',
        default: 200,
        min: 80,
        hidden: true,
        editorOnly: true,
      },
      { id: 'body', label: 'Text', kind: 'string', default: '', hidden: true, editorOnly: true },
    ])
  })

  describe('body text', () => {
    const noteId = asNodeId('note')
    const withComment = (): Graph =>
      unwrap(
        addNode(createGraph(), registry, {
          id: noteId,
          type: 'utility/comment',
          position: { x: 0, y: 0 },
        }),
      )

    it('editing the body leaves the topology key alone, so it never recompiles', () => {
      const graph = withComment()
      const edited = unwrap(
        setParam(graph, registry, { nodeId: noteId, paramId: 'body' }, 'Line one\nLine two'),
      )

      expect(edited.nodes[noteId]?.params['body']).toBe('Line one\nLine two')
      expect(topologyKey(edited, registry)).toBe(topologyKey(graph, registry))
    })

    it('a saved comment without body text still loads, and its body round-trips', () => {
      const saved = serializeGraph(withComment())
      expect(unwrap(parseGraph(saved, registry)).nodes[noteId]?.params['body']).toBeUndefined()

      const edited = unwrap(
        setParam(withComment(), registry, { nodeId: noteId, paramId: 'body' }, 'Keep me'),
      )
      const reloaded = unwrap(parseGraph(serializeGraph(edited), registry))
      expect(reloaded.nodes[noteId]?.params['body']).toBe('Keep me')
    })

    it('a comment saved narrower than the minimum still opens', () => {
      const narrow = unwrap(
        setParam(withComment(), registry, { nodeId: noteId, paramId: 'width' }, 320),
      )
      const saved = serializeGraph(narrow).replace('"width": 320', '"width": 100')
      expect(saved).toContain('"width": 100')

      expect(unwrap(parseGraph(saved, registry)).nodes[noteId]?.params['width']).toBe(100)
    })
  })
})

describe('master stack', () => {
  const master = requireDefinition('master/stack')

  it('master has lighting param default standard', () => {
    const lighting = master.params?.find((param) => param.id === 'lighting')

    expect(lighting).toEqual({
      id: 'lighting',
      label: 'Lighting',
      kind: 'enum',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'unlit', label: 'Unlit' },
        { value: 'physical', label: 'Physical' },
      ],
      default: 'standard',
    })
  })

  it('declares one physical feature switch per feature, all off', () => {
    const switches = master.params
      ?.filter((param) => param.id.startsWith('use'))
      .map((param) => ({
        id: param.id,
        label: param.label,
        kind: param.kind,
        default: param.default,
      }))

    expect(switches).toEqual([
      { id: 'useTransmission', label: 'Enable transmission', kind: 'boolean', default: false },
      { id: 'useClearcoat', label: 'Enable clearcoat', kind: 'boolean', default: false },
      { id: 'useSheen', label: 'Enable sheen', kind: 'boolean', default: false },
      { id: 'useIridescence', label: 'Enable iridescence', kind: 'boolean', default: false },
    ])
  })

  it('warns that transmission renders the scene behind once more', () => {
    const useTransmission = master.params?.find((param) => param.id === 'useTransmission')

    const description = useTransmission?.kind === 'boolean' ? useTransmission.description : ''

    expect(description).toMatch(/scene behind/)
  })

  it('appends the physical inputs with inline fields and their defaults', () => {
    const physical = master.inputs.slice(-9).map((input) => ({
      id: input.id,
      type: input.type,
      default: input.default,
      optional: input.optional === true,
      widget: input.widget,
    }))
    const float = (id: string, value: number) => ({
      id,
      type: { kind: 'concrete', type: 'float' },
      default: { type: 'float', value },
      optional: false,
      widget: undefined,
    })

    expect(physical).toEqual([
      float('transmission', 0),
      float('ior', 1.5),
      float('thickness', 0),
      float('clearcoat', 0),
      float('clearcoatRoughness', 0),
      {
        id: 'sheen',
        type: { kind: 'concrete', type: 'vec3' },
        default: { type: 'vec3', value: [0, 0, 0] },
        optional: false,
        widget: 'color',
      },
      float('sheenRoughness', 1),
      float('iridescence', 0),
      float('iridescenceIOR', 1.3),
    ])
    for (const input of master.inputs.slice(-9)) {
      expect(input.description, input.id).toBeTruthy()
    }
  })

  it('declares surface and two-sided params', () => {
    expect(master.params?.find((param) => param.id === 'surface')).toEqual({
      id: 'surface',
      label: 'Surface',
      kind: 'enum',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'opaque', label: 'Opaque' },
        { value: 'transparent', label: 'Transparent' },
      ],
      default: 'auto',
    })
    expect(master.params?.find((param) => param.id === 'twoSided')).toEqual({
      id: 'twoSided',
      label: 'Two sided',
      kind: 'boolean',
      default: false,
    })
  })

  it('adds an optional alpha clip threshold slot', () => {
    const alphaClip = master.inputs.find((input) => input.id === 'alphaClip')

    expect(alphaClip).toMatchObject({
      id: 'alphaClip',
      label: 'Alpha Clip Threshold',
      type: { kind: 'concrete', type: 'float' },
      default: { type: 'float', value: 0.5 },
      optional: true,
    })
  })
})

describe('compiling catalog B nodes', () => {
  const backend: CompileBackend<string> = {
    tsl: createRecordingFacade(),
    inputValue: (ref) => `u(${ref.nodeId}:${ref.portId})`,
    property: (property) => `prop(${property.name})`,
  }

  const compileOutput = (graph: Graph, nodeId: string, portId: string) =>
    compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId(nodeId), portId },
    })

  const graphWith = (type: string): Graph =>
    unwrap(
      addNode(createGraph(), registry, {
        id: asNodeId('n'),
        type,
        position: { x: 0, y: 0 },
      }),
    )

  it('unconnected uv falls back to builtin uv', () => {
    const result = compileOutput(graphWith('effects/checkerboard'), 'n', 'out')

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'checker(mul(builtin(uv),u(n:scale)))' },
    })
  })

  it('unconnected scene color uv falls back to the screen uv', () => {
    const result = compileOutput(graphWith('scene/scene-color'), 'n', 'out')

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'sceneColor(add(builtin(screenUV),u(n:offset)))' },
    })
  })

  it('unconnected fresnel normal and view direction fall back to the view builtins', () => {
    const result = compileOutput(graphWith('effects/fresnel'), 'n', 'out')

    expect(result).toEqual({
      ok: true,
      output: {
        kind: 'port',
        expression:
          'pow(oneMinus(clamp(dot(builtin(normalView),builtin(positionViewDirection)),' +
          'construct(float,[0]),construct(float,[1]))),u(n:power))',
      },
    })
  })
})
