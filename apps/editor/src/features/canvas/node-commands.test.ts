import { MASTER_NODE_ID, createGraph } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '@/store/editor-store'

import { duplicateNodes, selectAllNodes } from './node-commands'

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

function addNodeOrFail(type: string, position: { x: number; y: number }): NodeId {
  const id = getState().addNode(type, position)
  if (id === null) throw new Error(`Could not add node of type ${type}`)
  return id
}

/** A float node feeding a sine node. */
function connectedPair(): { source: NodeId; target: NodeId } {
  const source = addNodeOrFail('input/float', { x: 10, y: 20 })
  const target = addNodeOrFail('math/sin', { x: 200, y: 20 })
  getState().connect({ nodeId: source, portId: 'out' }, { nodeId: target, portId: 'in' })
  return { source, target }
}

beforeEach(() => {
  useEditorStore.setState({ graph: createGraph(), selectedNodeIds: [], draftPositions: {} })
  useEditorStore.temporal.getState().clear()
})

describe('duplicateNodes', () => {
  it('copies nodes and their edges beside them as one undo step, and selects the copies', () => {
    const { source, target } = connectedPair()
    const entriesBefore = historyLength()

    const duplicated = duplicateNodes([source, target])

    const graph = getState().graph
    expect(duplicated).toHaveLength(2)
    expect(Object.keys(graph.edges)).toHaveLength(2)
    expect(historyLength()).toBe(entriesBefore + 1)
    expect(getState().selectedNodeIds).toEqual(duplicated)
    expect(duplicated.map((id) => graph.nodes[id]?.position)).toContainEqual({ x: 50, y: 60 })
  })

  it('duplicates nothing for the master alone', () => {
    expect(duplicateNodes([MASTER_NODE_ID])).toEqual([])
  })
})

describe('selectAllNodes', () => {
  it('selects every node, the master included', () => {
    const { source, target } = connectedPair()
    selectAllNodes()
    expect([...getState().selectedNodeIds].sort()).toEqual([MASTER_NODE_ID, source, target].sort())
  })
})
