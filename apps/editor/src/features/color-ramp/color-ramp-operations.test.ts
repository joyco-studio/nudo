import {
  addNode,
  asEdgeId,
  asNodeId,
  connect,
  createGraph,
  float,
  setParam,
  vec3,
} from '@nudo-tsl/core'
import type { Graph, GraphEdge, NodeId, PortValue, Result } from '@nudo-tsl/core'
import { colorRampCount, colorRampStopInputIds } from '@nudo-tsl/nodes'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { addStop, moveStop, removeStop, swapStops } from './color-ramp-operations'
import { readColorRampStops } from './color-ramp-stops'

const RAMP_ID = asNodeId('ramp')
const TIME_ID = asNodeId('time')
const COLOR_ID = asNodeId('color')
const SINE_ID = asNodeId('sine')

function unwrap(result: Result<Graph, unknown>): Graph {
  if (!result.ok) throw new Error(`Graph operation failed: ${JSON.stringify(result.error)}`)
  return result.value
}

function withNode(graph: Graph, id: NodeId, type: string): Graph {
  return unwrap(addNode(graph, registry, { id, type, position: { x: 0, y: 0 } }))
}

function setValue(graph: Graph, portId: string, value: PortValue): Graph {
  const node = graph.nodes[RAMP_ID]
  if (node === undefined) throw new Error('No ramp in the graph')
  const updated = { ...node, inputValues: { ...node.inputValues, [portId]: value } }
  return { ...graph, nodes: { ...graph.nodes, [RAMP_ID]: updated } }
}

interface StopSeed {
  readonly position: number
  readonly color: readonly [number, number, number]
}

/** A ramp with the given stops, plus a Time, a Color and a Sine node to wire into it. */
function rampGraph(stops: readonly StopSeed[]): Graph {
  let graph = withNode(createGraph(), RAMP_ID, 'color/color-ramp')
  graph = withNode(graph, TIME_ID, 'input/time')
  graph = withNode(graph, COLOR_ID, 'input/color')
  graph = withNode(graph, SINE_ID, 'math/sin')
  graph = unwrap(setParam(graph, registry, { nodeId: RAMP_ID, paramId: 'count' }, stops.length))
  stops.forEach((stop, index) => {
    const ids = colorRampStopInputIds(index)
    graph = setValue(graph, ids.position, float(stop.position))
    graph = setValue(graph, ids.color, vec3(...stop.color))
  })
  return graph
}

function wire(graph: Graph, edgeId: string, fromNode: NodeId, toPort: string): Graph {
  return unwrap(
    connect(graph, registry, {
      id: asEdgeId(edgeId),
      from: { nodeId: fromNode, portId: 'out' },
      to: { nodeId: RAMP_ID, portId: toPort },
    }),
  )
}

function edge(graph: Graph, edgeId: string): GraphEdge | undefined {
  return graph.edges[asEdgeId(edgeId)]
}

function count(graph: Graph): number {
  return colorRampCount(graph.nodes[RAMP_ID]?.params ?? {})
}

function stops(graph: Graph): readonly StopSeed[] {
  const node = graph.nodes[RAMP_ID]
  if (node === undefined) throw new Error('No ramp in the graph')
  return readColorRampStops(node, registry).map((stop) => ({
    position: stop.position,
    color: stop.color,
  }))
}

const BLACK = [0, 0, 0] as const
const WHITE = [1, 1, 1] as const
const RED = [1, 0, 0] as const
const BLUE = [0, 0, 1] as const

const THREE_STOPS: readonly StopSeed[] = [
  { position: 0, color: BLACK },
  { position: 0.25, color: RED },
  { position: 1, color: WHITE },
]

describe('readColorRampStops', () => {
  it('reads the stops in play, falling back to the input defaults', () => {
    const graph = withNode(createGraph(), RAMP_ID, 'color/color-ramp')
    expect(stops(graph)).toEqual([
      { position: 0, color: BLACK },
      { position: 1, color: WHITE },
    ])
  })
})

describe('addStop', () => {
  it('inserts a stop at the middle of the widest gap, with the color the ramp has there', () => {
    const next = unwrap(addStop(rampGraph(THREE_STOPS), registry, RAMP_ID))

    expect(count(next)).toBe(4)
    expect(stops(next)).toEqual([
      { position: 0, color: BLACK },
      { position: 0.25, color: RED },
      { position: 0.625, color: [1, 0.5, 0.5] },
      { position: 1, color: WHITE },
    ])
  })

  it('takes the color of the stop before the gap on a constant ramp', () => {
    const constant = unwrap(
      setParam(
        rampGraph(THREE_STOPS),
        registry,
        { nodeId: RAMP_ID, paramId: 'interpolation' },
        'constant',
      ),
    )
    const next = unwrap(addStop(constant, registry, RAMP_ID))

    expect(stops(next)[2]).toEqual({ position: 0.625, color: RED })
  })

  it('shifts the edges of the later stops up one place', () => {
    const wired = wire(
      wire(rampGraph(THREE_STOPS), 'to-last-color', COLOR_ID, 'stop2Color'),
      'to-first-position',
      SINE_ID,
      'stop0Position',
    )
    const next = unwrap(addStop(wired, registry, RAMP_ID))

    expect(edge(next, 'to-last-color')?.to.portId).toBe('stop3Color')
    expect(edge(next, 'to-first-position')?.to.portId).toBe('stop0Position')
  })

  it('refuses a ninth stop', () => {
    const full = rampGraph(
      Array.from({ length: 8 }, (_, index) => ({ position: index / 7, color: WHITE })),
    )
    expect(addStop(full, registry, RAMP_ID)).toEqual({ ok: false, error: 'too-many-stops' })
  })

  it('refuses a node that is not a color ramp', () => {
    expect(addStop(rampGraph(THREE_STOPS), registry, SINE_ID)).toEqual({
      ok: false,
      error: 'not-a-color-ramp',
    })
  })
})

describe('removeStop', () => {
  it('shifts the later stops down and lowers the count', () => {
    const next = unwrap(removeStop(rampGraph(THREE_STOPS), registry, RAMP_ID, 1))

    expect(count(next)).toBe(2)
    expect(stops(next)).toEqual([
      { position: 0, color: BLACK },
      { position: 1, color: WHITE },
    ])
  })

  it('removes the edges of a wired stop and moves the later edges down (Review Focus 4)', () => {
    const wired = wire(
      wire(rampGraph(THREE_STOPS), 'to-middle-color', COLOR_ID, 'stop1Color'),
      'to-last-position',
      SINE_ID,
      'stop2Position',
    )
    const next = unwrap(removeStop(wired, registry, RAMP_ID, 1))

    expect(edge(next, 'to-middle-color')).toBeUndefined()
    expect(edge(next, 'to-last-position')?.to.portId).toBe('stop1Position')
  })

  it('never leaves an edge on a stop the new count hides', () => {
    const wired = wire(rampGraph(THREE_STOPS), 'to-last-color', COLOR_ID, 'stop2Color')
    const next = unwrap(removeStop(wired, registry, RAMP_ID, 2))
    const hidden = colorRampStopInputIds(2)

    expect(edge(next, 'to-last-color')).toBeUndefined()
    const onHidden = Object.values(next.edges).filter(
      (candidate) =>
        candidate.to.nodeId === RAMP_ID &&
        (candidate.to.portId === hidden.position || candidate.to.portId === hidden.color),
    )
    expect(onHidden).toEqual([])
  })

  it('refuses to go below two stops', () => {
    const twoStops = rampGraph(THREE_STOPS.slice(0, 2))
    expect(removeStop(twoStops, registry, RAMP_ID, 0)).toEqual({
      ok: false,
      error: 'too-few-stops',
    })
  })

  it('refuses a stop that is not in play', () => {
    expect(removeStop(rampGraph(THREE_STOPS), registry, RAMP_ID, 3)).toEqual({
      ok: false,
      error: 'stop-out-of-range',
    })
  })
})

describe('moveStop', () => {
  it('writes the new position', () => {
    const next = unwrap(moveStop(rampGraph(THREE_STOPS), registry, RAMP_ID, 1, 0.4))
    expect(stops(next)[1]?.position).toBe(0.4)
  })

  it('stops at the next stop instead of passing it', () => {
    const next = unwrap(moveStop(rampGraph(THREE_STOPS), registry, RAMP_ID, 1, 1.5))
    expect(stops(next)[1]?.position).toBe(1)
  })

  it('stops at the previous stop instead of passing it', () => {
    const next = unwrap(moveStop(rampGraph(THREE_STOPS), registry, RAMP_ID, 2, 0.1))
    expect(stops(next)[2]?.position).toBe(0.25)
  })

  it('keeps the first and last stops between 0 and 1', () => {
    const graph = rampGraph(THREE_STOPS)
    expect(stops(unwrap(moveStop(graph, registry, RAMP_ID, 0, -0.3)))[0]?.position).toBe(0)
  })

  it('leaves the edges and the count alone', () => {
    const wired = wire(rampGraph(THREE_STOPS), 'to-middle-color', COLOR_ID, 'stop1Color')
    const next = unwrap(moveStop(wired, registry, RAMP_ID, 1, 0.5))
    expect(next.edges).toEqual(wired.edges)
    expect(count(next)).toBe(3)
  })
})

describe('swapStops', () => {
  it('swaps the colors and keeps the positions in order', () => {
    const next = unwrap(swapStops(rampGraph(THREE_STOPS), registry, RAMP_ID, 1, 2))

    expect(stops(next)).toEqual([
      { position: 0, color: BLACK },
      { position: 0.25, color: WHITE },
      { position: 1, color: RED },
    ])
  })

  it('leaves the edges where they are', () => {
    const wired = wire(
      setValue(rampGraph(THREE_STOPS), 'stop0Color', vec3(...BLUE)),
      'to-first-color',
      COLOR_ID,
      'stop0Color',
    )
    const next = unwrap(swapStops(wired, registry, RAMP_ID, 0, 1))

    expect(next.edges).toEqual(wired.edges)
    expect(stops(next)[1]?.color).toEqual(BLUE)
  })

  it('refuses a stop that is not in play', () => {
    expect(swapStops(rampGraph(THREE_STOPS), registry, RAMP_ID, 2, 3)).toEqual({
      ok: false,
      error: 'stop-out-of-range',
    })
  })
})
