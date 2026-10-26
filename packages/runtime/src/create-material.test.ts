import {
  addNode,
  asEdgeId,
  asNodeId,
  concrete,
  connect,
  createGraph,
  createNodeRegistry,
  defineNode,
  float,
  portKey,
  vec3,
  vec4,
} from '@nudo-tsl/core'
import type { Graph, NodeRegistry, Result } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyInputValue } from './apply-input-value'
import { createMaterial } from './create-material'

const ORIGIN = { x: 0, y: 0 }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const INLINE_MASTER_SLOTS = ['baseColor', 'emission', 'metalness', 'roughness', 'opacity']

const masterKey = (slot: string) => portKey({ nodeId: asNodeId('master'), portId: slot })

const withNode = (graph: Graph, registry: NodeRegistry, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

const withEdge = (
  graph: Graph,
  registry: NodeRegistry,
  from: readonly [string, string],
  to: readonly [string, string],
): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(`${from.join('.')}->${to.join('.')}`),
      from: { nodeId: asNodeId(from[0]), portId: from[1] },
      to: { nodeId: asNodeId(to[0]), portId: to[1] },
    }),
  )

describe('createMaterial', () => {
  it('default graph builds a material with colorNode set and no positionNode', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
    expect(build.material?.colorNode).toBeTruthy()
    expect(build.material?.positionNode).toBeNull()
    expect(build.material?.normalNode).toBeNull()
    expect(build.material?.transparent).toBe(false)
  })

  it('uniform map has an entry per inline input reached', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())

    expect([...build.uniforms.keys()].sort()).toEqual(INLINE_MASTER_SLOTS.map(masterKey).sort())
  })

  it('applyInputValue updates value without rebuilding', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const { material } = build
    const ref = { nodeId: asNodeId('master'), portId: 'baseColor' }

    const applied = applyInputValue(build.uniforms, ref, vec3(1, 0.5, 0.25))

    expect(applied).toBe(true)
    expect(build.material).toBe(material)
    const uniform = build.uniforms.get(portKey(ref))
    expect(uniform?.value).toBeInstanceOf(Vector3)
    expect(uniform?.value).toEqual(new Vector3(1, 0.5, 0.25))
  })

  it('applyInputValue updates float uniforms', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const ref = { nodeId: asNodeId('master'), portId: 'roughness' }

    expect(applyInputValue(build.uniforms, ref, float(0.9))).toBe(true)
    expect(build.uniforms.get(portKey(ref))?.value).toBe(0.9)
  })

  it('applyInputValue returns false for unknown key', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const unknownRef = { nodeId: asNodeId('ghost'), portId: 'x' }

    expect(applyInputValue(build.uniforms, unknownRef, float(1))).toBe(false)
  })

  it('applyInputValue returns false and leaves the uniform alone on a type mismatch', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const colorRef = { nodeId: asNodeId('master'), portId: 'baseColor' }
    const roughnessRef = { nodeId: asNodeId('master'), portId: 'roughness' }

    expect(applyInputValue(build.uniforms, colorRef, float(1))).toBe(false)
    expect(applyInputValue(build.uniforms, colorRef, vec4(1, 1, 1, 1))).toBe(false)
    expect(applyInputValue(build.uniforms, roughnessRef, vec3(1, 1, 1))).toBe(false)
    expect(build.uniforms.get(portKey(colorRef))?.value).toEqual(new Vector3(0.8, 0.8, 0.8))
    expect(build.uniforms.get(portKey(roughnessRef))?.value).toBe(0.5)
  })

  it('throwing node returns material null and errors', () => {
    const throwingNode = defineNode({
      type: 'test/throwing',
      category: 'utility',
      label: 'Throwing',
      description: 'Always fails to build',
      keywords: [],
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
      build: () => {
        throw new Error('boom')
      },
    })
    const registry = createDefaultRegistry()
    unwrap(registry.register(throwingNode))
    const graph = withEdge(
      withNode(createGraph(), registry, 'bad', 'test/throwing'),
      registry,
      ['bad', 'out'],
      ['master', 'baseColor'],
    )

    const build = createMaterial(graph, registry)

    expect(build.material).toBeNull()
    expect(build.errors).toEqual([
      { nodeId: asNodeId('bad'), code: 'build-failed', message: 'boom' },
    ])
  })

  it('connected opacity sets transparent', () => {
    const registry = createDefaultRegistry()
    const graph = withEdge(
      withNode(createGraph(), registry, 'alpha', 'input/float'),
      registry,
      ['alpha', 'out'],
      ['master', 'opacity'],
    )

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material?.transparent).toBe(true)
    expect(build.material?.opacityNode).toBeTruthy()
  })

  it('maps connected builtins and optional slots onto the material', () => {
    const registry = createDefaultRegistry()
    const withNormal = withEdge(
      withNode(createGraph(), registry, 'n', 'input/normal'),
      registry,
      ['n', 'out'],
      ['master', 'normal'],
    )
    const graph = withEdge(
      withNode(withNormal, registry, 'p', 'input/normal'),
      registry,
      ['p', 'out'],
      ['master', 'position'],
    )

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material?.normalNode).toBeTruthy()
    expect(build.material?.positionNode).toBeTruthy()
  })

  it('builds the fresnel/lerp/time/uv nodes without errors', () => {
    const registry = createDefaultRegistry()
    let graph = createGraph()
    for (const [id, type] of [
      ['fresnel', 'effects/fresnel'],
      ['lerp', 'interpolation/lerp'],
      ['time', 'input/time'],
      ['sin', 'math/sin'],
      ['color', 'input/color'],
    ] as const) {
      graph = withNode(graph, registry, id, type)
    }
    graph = withEdge(graph, registry, ['time', 'out'], ['sin', 'in'])
    graph = withEdge(graph, registry, ['sin', 'out'], ['lerp', 't'])
    graph = withEdge(graph, registry, ['color', 'out'], ['lerp', 'a'])
    graph = withEdge(graph, registry, ['lerp', 'out'], ['master', 'baseColor'])
    graph = withEdge(graph, registry, ['fresnel', 'out'], ['master', 'emission'])

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
  })
})

describe('empty registry', () => {
  it('reports a missing master definition instead of throwing', () => {
    const build = createMaterial(createGraph(), createNodeRegistry())

    expect(build.material).toBeNull()
    expect(build.errors[0]?.code).toBe('missing-definition')
  })
})
