import { asNodeId } from '@nudo-tsl/core'
import type { EdgeChange, NodeChange } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { interpretEdgeChanges, interpretNodeChanges, planDeletion } from './interpret-flow-changes'
import type { FlowEdge, FlowNode } from './to-flow'

const A = asNodeId('a')
const B = asNodeId('b')

const NO_UI = { draftPositions: {}, selectedNodeIds: [] }

describe('interpretNodeChanges', () => {
  it('turns position changes while dragging into merged draft positions', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'position', id: 'b', position: { x: 5, y: 6 }, dragging: true },
    ]

    const intent = interpretNodeChanges(changes, {
      ...NO_UI,
      draftPositions: { [A]: { x: 1, y: 2 } },
    })

    expect(intent.draftPositions).toEqual({ [A]: { x: 1, y: 2 }, [B]: { x: 5, y: 6 } })
    expect(intent.committedPositions).toBeNull()
  })

  it('commits the drafts plus the final positions when a move ends', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'position', id: 'b', position: { x: 50, y: 60 }, dragging: false },
    ]

    const intent = interpretNodeChanges(changes, {
      ...NO_UI,
      draftPositions: { [A]: { x: 1, y: 2 }, [B]: { x: 5, y: 6 } },
    })

    expect(intent.committedPositions).toEqual({ [A]: { x: 1, y: 2 }, [B]: { x: 50, y: 60 } })
    expect(intent.draftPositions).toBeNull()
  })

  it('keeps a resize live: its position change is a draft and its size a draft size', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'position', id: 'a', position: { x: -20, y: 0 } },
      {
        type: 'dimensions',
        id: 'a',
        resizing: true,
        setAttributes: true,
        dimensions: { width: 340, height: 200 },
      },
    ]

    const intent = interpretNodeChanges(changes, NO_UI)

    expect(intent.draftPositions).toEqual({ [A]: { x: -20, y: 0 } })
    expect(intent.committedPositions).toBeNull()
    expect(intent.draftSizes).toEqual({ [A]: { width: 340, height: 200 } })
    expect(intent.endedResizes).toEqual({})
  })

  it('reports the final size when a resize ends', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'dimensions', id: 'a', resizing: false, dimensions: { width: 340, height: 220 } },
    ]

    const intent = interpretNodeChanges(changes, NO_UI)

    expect(intent.endedResizes).toEqual({ [A]: { width: 340, height: 220 } })
    expect(intent.draftSizes).toEqual({})
  })

  it('applies select changes to the current selection', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'select', id: 'a', selected: false },
      { type: 'select', id: 'b', selected: true },
    ]

    const intent = interpretNodeChanges(changes, { ...NO_UI, selectedNodeIds: [A] })

    expect(intent.selection).toEqual([B])
  })

  it('reports no selection when nothing about selection changed', () => {
    const intent = interpretNodeChanges([{ type: 'select', id: 'a', selected: true }], {
      ...NO_UI,
      selectedNodeIds: [A],
    })

    expect(intent.selection).toBeNull()
  })

  it('collects measured dimensions and ignores removals', () => {
    const changes: NodeChange<FlowNode>[] = [
      { type: 'remove', id: 'a' },
      { type: 'dimensions', id: 'b', dimensions: { width: 200, height: 120 } },
    ]

    const intent = interpretNodeChanges(changes, NO_UI)

    expect(intent.dimensions).toEqual({ b: { width: 200, height: 120 } })
    expect(intent).toMatchObject({
      draftPositions: null,
      committedPositions: null,
      selection: null,
    })
  })
})

describe('interpretEdgeChanges', () => {
  it('applies select changes and drops removed edges from the selection', () => {
    const changes: EdgeChange<FlowEdge>[] = [
      { type: 'remove', id: 'e1' },
      { type: 'select', id: 'e2', selected: true },
    ]

    expect(interpretEdgeChanges(changes, ['e1'])).toEqual(['e2'])
  })

  it('returns null when the selection did not change', () => {
    expect(interpretEdgeChanges([{ type: 'select', id: 'e1', selected: true }], ['e1'])).toBeNull()
  })
})

describe('planDeletion', () => {
  it('removes nodes and only the edges that do not touch a removed node', () => {
    const plan = planDeletion(
      [{ id: 'a' }],
      [
        { id: 'e1', source: 'a', target: 'master' },
        { id: 'e2', source: 'b', target: 'master' },
      ],
    )

    expect(plan).toEqual({ nodeIds: [A], edgeIds: ['e2'] })
  })
})
