import { addNode, asEdgeId, asNodeId, compile, connect, createGraph } from '@nudo-tsl/core'
import type { CompileBackend, Graph, NodeRegistry, Result } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry, createRecordingFacade, fresnelNode } from './index'

const PHASE_1_TYPES = [
  'master/stack',
  'input/float',
  'input/color',
  'input/time',
  'input/uv',
  'input/normal',
  'math/add',
  'math/multiply',
  'math/sin',
  'interpolation/lerp',
  'effects/fresnel',
]

const ORIGIN = { x: 0, y: 0 }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const createRecordingBackend = (): CompileBackend<string> => ({
  tsl: createRecordingFacade(),
  inputValue: (ref) => `u(${ref.nodeId}:${ref.portId})`,
  property: (property) => `prop(${property.name})`,
})

const withNode = (graph: Graph, registry: NodeRegistry, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

const withEdge = (
  graph: Graph,
  registry: NodeRegistry,
  id: string,
  from: readonly [string, string],
  to: readonly [string, string],
): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(id),
      from: { nodeId: asNodeId(from[0]), portId: from[1] },
      to: { nodeId: asNodeId(to[0]), portId: to[1] },
    }),
  )

describe('default registry', () => {
  it('still contains every phase-1 type', () => {
    const types = new Set(
      createDefaultRegistry()
        .list()
        .map((definition) => definition.type),
    )

    for (const type of PHASE_1_TYPES) {
      expect(types.has(type), type).toBe(true)
    }
  })

  it('defines the master stack without outputs', () => {
    const master = createDefaultRegistry().get('master/stack')

    expect(master?.category).toBe('master')
    expect(master?.outputs).toEqual([])
    expect(master?.inputs.map((input) => input.id)).toEqual([
      'position',
      'baseColor',
      'emission',
      'metalness',
      'roughness',
      'normal',
      'opacity',
      'alphaClip',
      'transmission',
      'ior',
      'thickness',
      'clearcoat',
      'clearcoatRoughness',
      'sheen',
      'sheenRoughness',
      'iridescence',
      'iridescenceIOR',
    ])
    expect(master?.inputs.filter((input) => input.optional === true).map((i) => i.id)).toEqual([
      'position',
      'normal',
      'alphaClip',
    ])
  })
})

describe('recording facade', () => {
  it('prints every call as name(args)', () => {
    const tsl = createRecordingFacade()

    expect(tsl.mix('a', 'b', 't')).toBe('mix(a,b,t)')
    expect(tsl.builtin('time')).toBe('builtin(time)')
    expect(tsl.construct('float', [0])).toBe('construct(float,[0])')
    expect(tsl.swizzle('v', 'xy')).toBe('swizzle(v,xy)')
  })

  it('prints the new facade methods in the same format', () => {
    const tsl = createRecordingFacade()

    expect(tsl.select('lt', 'a', 'b', 't', 'f')).toBe('select(lt,a,b,t,f)')
    expect(tsl.noise('simplex', 'p')).toBe('noise(simplex,p)')
    expect(tsl.textureSample('t', 'uv', null)).toBe('textureSample(t,uv,null)')
    expect(tsl.textureSample('t', 'uv', 'lod')).toBe('textureSample(t,uv,lod)')
    expect(tsl.colorSpace('srgb-to-linear', 'c')).toBe('colorSpace(srgb-to-linear,c)')
    expect(tsl.remap('x', 'a', 'b', 'c', 'd')).toBe('remap(x,a,b,c,d)')
    expect(tsl.smoothstep('e0', 'e1', 'x')).toBe('smoothstep(e0,e1,x)')
    expect(tsl.voronoi('p', 'j', 'manhattan')).toBe('voronoi(p,j,manhattan)')
    expect(tsl.voronoiCell(3, 'p', 'j', 'chebyshev')).toBe('voronoiCell(3,p,j,chebyshev)')
    expect(tsl.cellNoise('p')).toBe('cellNoise(p)')
    expect(tsl.checker('uv')).toBe('checker(uv)')
    expect(tsl.swizzle('v', 'w')).toBe('swizzle(v,w)')
  })
})

describe('fresnel', () => {
  it('builds the expected expression', () => {
    const { out } = fresnelNode.build({
      tsl: createRecordingFacade(),
      inputs: { normal: 'normal', viewDir: 'viewDir', power: 'power' },
      resolvedTypes: { normal: 'vec3', viewDir: 'vec3', power: 'float' },
      params: {},
      property: null,
    })

    expect(out).toBe(
      'pow(oneMinus(clamp(dot(normal,viewDir),construct(float,[0]),construct(float,[1]))),power)',
    )
  })
})

describe('compiling a built-in graph', () => {
  it('succeeds for Time -> Sin -> Lerp -> baseColor', () => {
    const registry = createDefaultRegistry()
    let graph = createGraph()
    graph = withNode(graph, registry, 'time', 'input/time')
    graph = withNode(graph, registry, 'sin', 'math/sin')
    graph = withNode(graph, registry, 'lerp', 'interpolation/lerp')
    graph = withEdge(graph, registry, 'e1', ['time', 'out'], ['sin', 'in'])
    graph = withEdge(graph, registry, 'e2', ['sin', 'out'], ['lerp', 't'])
    graph = withEdge(graph, registry, 'e3', ['lerp', 'out'], ['master', 'baseColor'])

    const result = compile(graph, registry, createRecordingBackend(), { kind: 'master' })

    expect(result.ok).toBe(true)
    if (!result.ok || result.output.kind !== 'master') return
    expect(result.output.slots.baseColor).toBe(
      'construct(vec3,[mix(u(lerp:a),u(lerp:b),sin(builtin(time)))])',
    )
  })
})

describe('preview hints', () => {
  const registry = createDefaultRegistry()

  it('loops the Time output in previews, since raw seconds would saturate to white', () => {
    const outputs = registry.get('input/time')?.outputs ?? []
    expect(outputs.find((output) => output.id === 'out')?.preview).toBe('repeat')
    // The bounded outputs (sine, cosine, delta) already stay in range.
    expect(outputs.filter((output) => output.preview !== undefined)).toHaveLength(1)
  })
})
