import { MASTER_NODE_ID, asEdgeId, asNodeId } from '@nudo-tsl/core'
import type { GraphEdge, NodeId, XY } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { planTidyUp } from './plan-tidy-up'
import type { NodeGeometry } from './plan-tidy-up'

const node = (
  id: string,
  x: number,
  y: number,
  extra: Partial<NodeGeometry> = {},
): NodeGeometry => ({
  id: asNodeId(id),
  position: { x, y },
  width: 200,
  height: 100,
  isFrame: false,
  inputY: { in: 50, a: 40, b: 70, baseColor: 60, roughness: 200 },
  outputY: { out: 50 },
  ...extra,
})

const edge = (from: string, to: string, toPort = 'in'): GraphEdge => ({
  id: asEdgeId(`${from}-${to}-${toPort}`),
  from: { nodeId: asNodeId(from), portId: 'out' },
  to: { nodeId: asNodeId(to), portId: toPort },
})

const MASTER = node(MASTER_NODE_ID, 800, 0, { width: 260, height: 400 })

function placed(nodes: readonly NodeGeometry[], plan: Readonly<Partial<Record<NodeId, XY>>>) {
  return new Map(
    nodes.map((item) => [item.id, { ...item, position: plan[item.id] ?? item.position }]),
  )
}

describe('planTidyUp', () => {
  const nodes = [MASTER, node('time', 900, 600), node('sine', -200, 300), node('color', 400, 500)]
  const edges = [
    edge('time', 'sine'),
    edge('sine', MASTER_NODE_ID, 'roughness'),
    edge('color', MASTER_NODE_ID, 'baseColor'),
  ]

  it('lays out the whole graph left to right with the master last and unmoved', () => {
    const plan = planTidyUp(edges, nodes, { kind: 'graph' })
    const after = placed(nodes, plan)

    expect(plan[MASTER_NODE_ID] ?? MASTER.position).toEqual(MASTER.position)
    for (const { from, to } of edges) {
      const source = after.get(from.nodeId)
      const target = after.get(to.nodeId)
      if (source === undefined || target === undefined) throw new Error('missing node')
      expect(source.position.x + source.width).toBeLessThan(target.position.x)
    }
  })

  it('moves a comment frame with the nodes on it, as one block', () => {
    const frame = node('frame', 0, 0, { width: 600, height: 300, isFrame: true })
    const framed = [MASTER, frame, node('time', 40, 60), node('sine', 320, 120)]
    const plan = planTidyUp(
      [edge('time', 'sine'), edge('sine', MASTER_NODE_ID, 'roughness')],
      framed,
      { kind: 'graph' },
    )
    const after = placed(framed, plan)
    const movedFrame = after.get(asNodeId('frame'))?.position
    if (movedFrame === undefined) throw new Error('missing frame')

    expect(movedFrame).not.toEqual(frame.position)
    expect(after.get(asNodeId('time'))?.position).toEqual({
      x: movedFrame.x + 40,
      y: movedFrame.y + 60,
    })
    expect(after.get(asNodeId('sine'))?.position).toEqual({
      x: movedFrame.x + 320,
      y: movedFrame.y + 120,
    })
  })

  it('treats a node whose middle is outside every frame as a node of its own', () => {
    const frame = node('frame', 0, 0, { width: 300, height: 200, isFrame: true })
    const sine = node('sine', 250, 150)
    const plan = planTidyUp([edge('sine', MASTER_NODE_ID, 'roughness')], [MASTER, frame, sine], {
      kind: 'graph',
    })
    const movedSine = plan[sine.id]
    // An empty frame has no links: it joins the row of unlinked blocks under the layout.
    const movedFrame = plan[frame.id]
    if (movedSine === undefined || movedFrame === undefined) throw new Error('nothing moved')
    expect(movedSine.x - sine.position.x).not.toBe(movedFrame.x - frame.position.x)
  })

  it('tidies only the selection (and the frames holding it), leaving the rest alone', () => {
    const plan = planTidyUp(edges, nodes, {
      kind: 'selection',
      nodeIds: [asNodeId('time'), asNodeId('sine')],
    })

    expect(Object.keys(plan).sort()).toEqual(['sine', 'time'])
    const time = plan[asNodeId('time')]
    const sine = plan[asNodeId('sine')]
    if (time === undefined || sine === undefined) throw new Error('missing node')
    expect(time.x + 200).toBeLessThan(sine.x)
  })

  it('has nothing to do for fewer than two blocks', () => {
    expect(planTidyUp(edges, nodes, { kind: 'selection', nodeIds: [asNodeId('time')] })).toEqual({})
    expect(planTidyUp([], [MASTER], { kind: 'graph' })).toEqual({})
  })

  it('leaves out nodes that are already where the layout puts them', () => {
    const plan = planTidyUp(edges, nodes, { kind: 'graph' })
    const settled = [...placed(nodes, plan).values()]
    expect(planTidyUp(edges, settled, { kind: 'graph' })).toEqual({})
  })
})
