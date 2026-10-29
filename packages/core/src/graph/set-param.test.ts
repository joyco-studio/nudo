import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import { topologyKey } from '../topology/topology-key'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, asNodeId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, vec3 } from '../values/port-value-factories'
import { addNode } from './add-node'
import { createGraph } from './create-graph'
import { setParam } from './set-param'

const noise = defineNode({
  type: 'test/noise',
  category: 'texture',
  label: 'Noise',
  description: 'Noise with params',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    {
      id: 'kind',
      label: 'Kind',
      kind: 'enum',
      options: [
        { value: 'simplex', label: 'Simplex' },
        { value: 'perlin', label: 'Perlin' },
      ],
      default: 'simplex',
    },
    { id: 'wrap', label: 'Wrap', kind: 'boolean', default: true },
    { id: 'octaves', label: 'Octaves', kind: 'number', default: 4, min: 1, max: 8 },
    { id: 'title', label: 'Title', kind: 'string', default: 'Noise' },
  ],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const redeclaring = defineNode({
  type: 'test/redeclaring',
  category: 'utility',
  label: 'Redeclaring',
  description: 'Redeclares reserved universal param ids',
  keywords: [],
  inputs: [],
  outputs: [],
  params: [
    { id: 'collapsed', label: 'Collapsed', kind: 'string', default: 'no' },
    { id: 'previewMode', label: 'Mode', kind: 'boolean', default: true },
  ],
  build: () => ({}),
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [{ id: 'baseColor', label: 'Base', type: concrete('vec3'), default: vec3(1, 1, 1) }],
  outputs: [],
  build: () => ({}),
})

const registry = createNodeRegistry()
registry.register(master)
registry.register(noise)
registry.register(redeclaring)

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const noiseId = asNodeId('n')
const graphWithNoise = (): Graph =>
  unwrap(
    addNode(createGraph(), registry, {
      id: noiseId,
      type: 'test/noise',
      position: { x: 0, y: 0 },
    }),
  )

describe('addNode default params', () => {
  it('fills enum and boolean defaults, and leaves string and number params absent', () => {
    expect(graphWithNoise().nodes[noiseId]?.params).toEqual({ kind: 'simplex', wrap: true })
  })

  it('does not write universal params', () => {
    const params = graphWithNoise().nodes[noiseId]?.params
    expect(params).not.toHaveProperty('collapsed')
    expect(params).not.toHaveProperty('previewMode')
  })
})

describe('setParam', () => {
  const ref = (paramId: string, nodeId = noiseId) => ({ nodeId, paramId })

  it('sets an enum, boolean, number and string param', () => {
    let graph = graphWithNoise()
    graph = unwrap(setParam(graph, registry, ref('kind'), 'perlin'))
    graph = unwrap(setParam(graph, registry, ref('wrap'), false))
    graph = unwrap(setParam(graph, registry, ref('octaves'), 6))
    graph = unwrap(setParam(graph, registry, ref('title'), 'Clouds'))

    expect(graph.nodes[noiseId]?.params).toEqual({
      kind: 'perlin',
      wrap: false,
      octaves: 6,
      title: 'Clouds',
    })
  })

  it('does not mutate the previous graph', () => {
    const graph = graphWithNoise()
    unwrap(setParam(graph, registry, ref('kind'), 'perlin'))
    expect(graph.nodes[noiseId]?.params).toEqual({ kind: 'simplex', wrap: true })
  })

  it('rejects an unknown param', () => {
    expect(setParam(graphWithNoise(), registry, ref('missing'), 1)).toEqual({
      ok: false,
      error: { code: 'unknown-param', nodeId: noiseId, paramId: 'missing' },
    })
  })

  it('rejects an enum value outside its options', () => {
    expect(setParam(graphWithNoise(), registry, ref('kind'), 'worley')).toEqual({
      ok: false,
      error: { code: 'invalid-param-value', nodeId: noiseId, paramId: 'kind' },
    })
  })

  it('rejects a value of the wrong kind', () => {
    expect(setParam(graphWithNoise(), registry, ref('wrap'), 'yes').ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), '4').ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), Number.NaN).ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), 9).ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), 0).ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), 8).ok).toBe(true)
    expect(setParam(graphWithNoise(), registry, ref('octaves'), 1).ok).toBe(true)
    expect(setParam(graphWithNoise(), registry, ref('title'), 3).ok).toBe(false)
  })

  it('rejects a missing node', () => {
    expect(setParam(graphWithNoise(), registry, ref('kind', asNodeId('nope')), 'perlin')).toEqual({
      ok: false,
      error: { code: 'node-not-found', nodeId: asNodeId('nope') },
    })
  })

  it('accepts the universal params on any node, including the master', () => {
    let graph = graphWithNoise()
    graph = unwrap(setParam(graph, registry, ref('collapsed'), true))
    graph = unwrap(setParam(graph, registry, ref('previewMode', MASTER_NODE_ID), '3d'))

    expect(graph.nodes[noiseId]?.params).toEqual({ kind: 'simplex', wrap: true, collapsed: true })
    expect(graph.nodes[MASTER_NODE_ID]?.params).toEqual({ previewMode: '3d' })
  })

  it('accepts the universal showPreview toggle and keeps it out of the topology key', () => {
    const graph = graphWithNoise()
    const hidden = unwrap(setParam(graph, registry, ref('showPreview'), false))

    expect(hidden.nodes[noiseId]?.params.showPreview).toBe(false)
    expect(topologyKey(hidden)).toBe(topologyKey(graph))
    expect(setParam(graph, registry, ref('showPreview'), 'no').ok).toBe(false)
  })

  it('rejects an invalid universal param value', () => {
    expect(setParam(graphWithNoise(), registry, ref('previewMode'), '4d').ok).toBe(false)
    expect(setParam(graphWithNoise(), registry, ref('collapsed'), 'true').ok).toBe(false)
  })

  it('leaves the topology key untouched for universal params but not for structural ones', () => {
    const graph = graphWithNoise()
    const collapsed = unwrap(setParam(graph, registry, ref('collapsed'), true))
    const previewed = unwrap(setParam(collapsed, registry, ref('previewMode'), '2d'))
    const structural = unwrap(setParam(graph, registry, ref('kind'), 'perlin'))

    expect(topologyKey(previewed)).toBe(topologyKey(graph))
    expect(topologyKey(structural)).not.toBe(topologyKey(graph))
  })
})

describe('reserved universal param ids', () => {
  const nodeId = asNodeId('r')
  const graph = (): Graph =>
    unwrap(
      addNode(createGraph(), registry, {
        id: nodeId,
        type: 'test/redeclaring',
        position: { x: 0, y: 0 },
      }),
    )

  it('keeps the universal definition when a node redeclares the id', () => {
    const collapsedRef = { nodeId, paramId: 'collapsed' }
    const previewRef = { nodeId, paramId: 'previewMode' }

    expect(setParam(graph(), registry, collapsedRef, 'no').ok).toBe(false)
    expect(setParam(graph(), registry, collapsedRef, true).ok).toBe(true)
    expect(setParam(graph(), registry, previewRef, true).ok).toBe(false)
    expect(setParam(graph(), registry, previewRef, '3d').ok).toBe(true)
  })

  it('does not write defaults for redeclared reserved ids', () => {
    expect(graph().nodes[nodeId]?.params).toEqual({})
  })
})
