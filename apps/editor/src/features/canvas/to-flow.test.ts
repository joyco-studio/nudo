import {
  MASTER_NODE_ID,
  addNode,
  asEdgeId,
  asNodeId,
  connect,
  createGraph,
  resolvePortTypes,
} from '@nudo-tsl/core'
import type { Graph, NodeId, PortRef } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { registry } from '../../store/registry'
import { nodeDescriptionId, toFlow } from './to-flow'

const COLOR_ID = asNodeId('color')
const TIME_ID = asNodeId('time')

function unwrap(result: { ok: true; value: Graph } | { ok: false; error: unknown }): Graph {
  if (!result.ok) throw new Error(`Graph operation failed: ${JSON.stringify(result.error)}`)
  return result.value
}

function withNode(graph: Graph, id: NodeId, type: string, x = 0, y = 0): Graph {
  return unwrap(addNode(graph, registry, { id, type, position: { x, y } }))
}

function withEdge(graph: Graph, id: string, from: PortRef, to: PortRef): Graph {
  return unwrap(connect(graph, registry, { id: asEdgeId(id), from, to }))
}

/** Master, a Color node feeding Base Color and a Time node feeding Emission (float → vec3). */
function sampleGraph(): Graph {
  let graph = withNode(createGraph(), COLOR_ID, 'input/color', 10, 20)
  graph = withNode(graph, TIME_ID, 'input/time', 30, 40)
  graph = withEdge(
    graph,
    'color-to-base',
    { nodeId: COLOR_ID, portId: 'out' },
    { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
  )
  return withEdge(
    graph,
    'time-to-emission',
    { nodeId: TIME_ID, portId: 'out' },
    { nodeId: MASTER_NODE_ID, portId: 'emission' },
  )
}

function flowFor(
  graph: Graph,
  overrides: Partial<{
    draft: Parameters<typeof toFlow>[3]
    errors: Parameters<typeof toFlow>[4]
    selected: readonly NodeId[]
  }> = {},
) {
  return toFlow(
    graph,
    registry,
    resolvePortTypes(graph, registry),
    overrides.draft ?? {},
    overrides.errors ?? {},
    overrides.selected ?? [],
  )
}

function findNode(flow: ReturnType<typeof flowFor>, id: NodeId) {
  const node = flow.nodes.find((candidate) => candidate.id === id)
  if (node === undefined) throw new Error(`Missing flow node ${id}`)
  return node
}

describe('toFlow', () => {
  it('toFlow applies draft positions over graph positions', () => {
    const flow = flowFor(sampleGraph(), { draft: { [COLOR_ID]: { x: 99, y: 77 } } })

    expect(findNode(flow, COLOR_ID).position).toEqual({ x: 99, y: 77 })
    expect(findNode(flow, TIME_ID).position).toEqual({ x: 30, y: 40 })
  })

  it('toFlow marks connected inputs and errors', () => {
    const flow = flowFor(sampleGraph(), { errors: { [COLOR_ID]: 'Something broke' } })

    const master = findNode(flow, MASTER_NODE_ID)
    expect([...master.data.connectedInputs].sort()).toEqual(['baseColor', 'emission'])
    expect(master.data.error).toBeUndefined()
    expect(findNode(flow, COLOR_ID).data.connectedInputs.size).toBe(0)
    expect(findNode(flow, COLOR_ID).data.error).toBe('Something broke')
  })

  it('exposes resolved port types per node', () => {
    const flow = flowFor(sampleGraph())

    const master = findNode(flow, MASTER_NODE_ID)
    expect(master.data.inputTypes).toMatchObject({ baseColor: 'vec3', roughness: 'float' })
    expect(findNode(flow, COLOR_ID).data.outputTypes).toEqual({ out: 'vec3' })
  })

  it('points each node at its description element instead of using aria-description', () => {
    const flow = flowFor(sampleGraph())

    const time = findNode(flow, TIME_ID)
    expect(time.domAttributes).toEqual({ 'aria-describedby': nodeDescriptionId(TIME_ID) })
    expect(nodeDescriptionId(TIME_ID)).not.toBe(nodeDescriptionId(COLOR_ID))
  })

  it('marks selected nodes and makes only the master undeletable', () => {
    const flow = flowFor(sampleGraph(), { selected: [COLOR_ID] })

    expect(findNode(flow, COLOR_ID).selected).toBe(true)
    expect(findNode(flow, TIME_ID).selected).toBe(false)
    expect(findNode(flow, MASTER_NODE_ID).deletable).toBe(false)
    expect(findNode(flow, COLOR_ID).deletable).toBe(true)
  })

  it('maps edges to typed edges carrying the source type and any conversion', () => {
    const flow = flowFor(sampleGraph())

    const byId = new Map(flow.edges.map((edge) => [edge.id, edge]))
    expect(byId.get('color-to-base')).toMatchObject({
      source: COLOR_ID,
      sourceHandle: 'out',
      target: MASTER_NODE_ID,
      targetHandle: 'baseColor',
      type: 'typed',
      data: { sourceType: 'vec3', conversion: null },
    })
    expect(byId.get('time-to-emission')?.data).toEqual({
      sourceType: 'float',
      conversion: { kind: 'splat', from: 'float', to: 'vec3' },
    })
  })

  it('skips nodes whose definition is not registered', () => {
    const graph: Graph = {
      ...createGraph(),
      nodes: {
        ...createGraph().nodes,
        [asNodeId('ghost')]: {
          id: asNodeId('ghost'),
          type: 'nope/missing',
          position: { x: 0, y: 0 },
          inputValues: {},
          params: {},
        },
      },
    }

    expect(flowFor(graph).nodes.map((node) => node.id)).toEqual([MASTER_NODE_ID])
  })
})
