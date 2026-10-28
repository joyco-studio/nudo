import {
  MASTER_NODE_ID,
  asEdgeId,
  asNodeId,
  concrete,
  createGraph,
  defineNode,
  float,
} from '@nudo-tsl/core'
import type { GraphFragment, NodeId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { redo, undo, useEditorStore } from './editor-store'
import { registry } from './registry'

const FLOAT_NODE = 'input/float'
const ORIGIN = { x: 0, y: 0 }

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

function addNodeOrFail(type: string, position = ORIGIN): NodeId {
  const id = getState().addNode(type, position)
  if (id === null) throw new Error(`Could not add node of type ${type}`)
  return id
}

beforeEach(() => {
  useEditorStore.setState({
    graph: createGraph(),
    selectedNodeIds: [],
    draftPositions: {},
    inputPreview: null,
    notice: null,
    errorsByNode: {},
  })
  useEditorStore.temporal.getState().clear()
})

describe('history', () => {
  it('addNode then undo restores previous graph; redo reapplies', () => {
    const initialGraph = getState().graph
    const id = addNodeOrFail(FLOAT_NODE)
    const graphWithNode = getState().graph
    expect(graphWithNode.nodes[id]).toBeDefined()

    undo()
    expect(getState().graph).toBe(initialGraph)

    redo()
    expect(getState().graph).toBe(graphWithNode)
  })

  it('removeNodes of a connected node then undo restores node and edges', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const check = getState().connect(
      { nodeId: id, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    )
    expect(check.ok).toBe(true)
    const connectedGraph = getState().graph
    expect(Object.keys(connectedGraph.edges)).toHaveLength(1)

    getState().removeNodes([id])
    expect(getState().graph.nodes[id]).toBeUndefined()
    expect(Object.keys(getState().graph.edges)).toHaveLength(0)

    undo()
    expect(getState().graph).toBe(connectedGraph)
  })

  it('drag: setDraftPositions creates no history; commitMove creates exactly one entry', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const entriesBeforeDrag = historyLength()

    getState().setDraftPositions({ [id]: { x: 10, y: 10 } })
    getState().setDraftPositions({ [id]: { x: 20, y: 30 } })
    expect(historyLength()).toBe(entriesBeforeDrag)
    expect(getState().draftPositions[id]).toEqual({ x: 20, y: 30 })

    getState().commitMove({ [id]: { x: 20, y: 30 } })
    expect(historyLength()).toBe(entriesBeforeDrag + 1)
    expect(getState().graph.nodes[id]?.position).toEqual({ x: 20, y: 30 })
    expect(getState().draftPositions).toEqual({})

    undo()
    expect(getState().graph.nodes[id]?.position).toEqual(ORIGIN)
  })

  it('selection and notices do not create history entries', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const entries = historyLength()

    getState().setSelection([id])
    getState().showNotice({ kind: 'info', messageKey: 'notice.masterDelete' })
    getState().dismissNotice()

    expect(historyLength()).toBe(entries)
  })

  it('setInputValue is undoable', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const graphBefore = getState().graph

    getState().setInputValue({ nodeId: id, portId: 'x' }, float(3))
    expect(getState().graph.nodes[id]?.inputValues.x).toEqual(float(3))

    undo()
    expect(getState().graph).toBe(graphBefore)
  })

  it('previewing an input value leaves the graph and the history alone', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const graphBefore = getState().graph
    const entries = historyLength()
    const ref = { nodeId: id, portId: 'x' }

    getState().previewInputValue(ref, float(2))
    getState().previewInputValue(ref, float(3))

    expect(getState().inputPreview).toEqual({ ref, value: float(3) })
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(entries)

    getState().clearInputPreview()
    expect(getState().inputPreview).toBeNull()
    expect(historyLength()).toBe(entries)
  })

  it('committing a previewed value is a single undo step', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const graphBefore = getState().graph
    const entries = historyLength()
    const ref = { nodeId: id, portId: 'x' }

    getState().previewInputValue(ref, float(1))
    getState().previewInputValue(ref, float(2))
    getState().setInputValue(ref, float(2))
    getState().clearInputPreview()

    expect(historyLength()).toBe(entries + 1)
    undo()
    expect(getState().graph).toBe(graphBefore)
  })

  it('disconnect removes the edge and is undoable', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    getState().connect(
      { nodeId: id, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    )
    const connectedGraph = getState().graph
    const [edgeId] = Object.keys(connectedGraph.edges)
    if (edgeId === undefined) throw new Error('Expected an edge')

    getState().disconnect([asEdgeId(edgeId)])
    expect(Object.keys(getState().graph.edges)).toHaveLength(0)

    undo()
    expect(getState().graph).toBe(connectedGraph)
  })
})

describe('commitMove without movement', () => {
  it('clears draft positions without creating a history entry', () => {
    const id = addNodeOrFail(FLOAT_NODE, { x: 7, y: 7 })
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    getState().setDraftPositions({ [id]: { x: 7, y: 7 } })
    getState().commitMove({ [id]: { x: 7, y: 7 } })

    expect(getState().graph).toBe(graphBefore)
    expect(getState().draftPositions).toEqual({})
    expect(historyLength()).toBe(entriesBefore)
  })
})

describe('connect replacing an input edge', () => {
  it('swaps the old edge for the new one in a single history entry', () => {
    const first = addNodeOrFail(FLOAT_NODE)
    const second = addNodeOrFail(FLOAT_NODE)
    const roughness = { nodeId: MASTER_NODE_ID, portId: 'roughness' }
    getState().connect({ nodeId: first, portId: 'out' }, roughness)
    const [oldEdgeId] = Object.keys(getState().graph.edges)
    const connectedGraph = getState().graph
    const entriesBefore = historyLength()

    const check = getState().connect({ nodeId: second, portId: 'out' }, roughness)

    expect(check.ok).toBe(true)
    const edges = Object.values(getState().graph.edges)
    expect(edges).toHaveLength(1)
    expect(edges[0]?.from.nodeId).toBe(second)
    expect(edges[0]?.id).not.toBe(oldEdgeId)
    expect(historyLength()).toBe(entriesBefore + 1)

    undo()
    expect(getState().graph).toBe(connectedGraph)
  })
})

describe('selection consistency', () => {
  it('removeNodes prunes removed ids from selection and draft positions', () => {
    const kept = addNodeOrFail(FLOAT_NODE)
    const removed = addNodeOrFail(FLOAT_NODE)
    getState().setSelection([kept, removed])
    getState().setDraftPositions({ [removed]: { x: 1, y: 1 }, [kept]: { x: 2, y: 2 } })

    getState().removeNodes([removed])

    expect(getState().selectedNodeIds).toEqual([kept])
    expect(getState().draftPositions).toEqual({ [kept]: { x: 2, y: 2 } })
  })

  it('undoing the add of a selected node deselects it, and redo does not resurrect the selection', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    getState().setSelection([id])

    undo()
    expect(getState().selectedNodeIds).toEqual([])

    redo()
    expect(getState().graph.nodes[id]).toBeDefined()
    expect(getState().selectedNodeIds).toEqual([])
  })

  it('pruning never creates a history entry', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    getState().setSelection([id])
    const entriesBefore = historyLength()

    undo()

    expect(historyLength()).toBe(0)
    expect(useEditorStore.temporal.getState().futureStates).toHaveLength(1)
    expect(entriesBefore).toBe(1)
  })
})

describe('rejected operations', () => {
  it('rejected connect leaves history unchanged', () => {
    const id = addNodeOrFail(FLOAT_NODE)
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    const check = getState().connect({ nodeId: id, portId: 'out' }, { nodeId: id, portId: 'x' })

    expect(check).toEqual({ ok: false, reason: 'same-node' })
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(entriesBefore)
  })

  it('addNode with an unknown type returns null and leaves history unchanged', () => {
    const graphBefore = getState().graph

    expect(getState().addNode('does/not-exist', ORIGIN)).toBeNull()
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(0)
  })

  it('removeNodes(["master"]) is a no-op with notice', () => {
    const graphBefore = getState().graph

    getState().removeNodes([MASTER_NODE_ID])

    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(0)
    expect(getState().notice).toEqual({
      kind: 'info',
      messageKey: 'notice.masterDelete',
    })
  })

  it('removeNodes with an unknown id leaves the graph and history untouched', () => {
    const graphBefore = getState().graph

    getState().removeNodes([asNodeId('ghost')])

    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(0)
  })
})

describe('pasteFragment', () => {
  it('adds the fragment nodes, selects them and returns their ids', () => {
    const source = addNodeOrFail(FLOAT_NODE, { x: 5, y: 5 })
    const sourceNode = getState().graph.nodes[source]
    if (sourceNode === undefined) throw new Error('Expected source node')
    const fragment: GraphFragment = {
      kind: 'nudo-tsl/fragment',
      schemaVersion: 1,
      nodes: [sourceNode],
      edges: [],
    }
    const entriesBefore = historyLength()

    const pastedIds = getState().pasteFragment(fragment, { x: 40, y: 40 })

    expect(pastedIds).toHaveLength(1)
    const [pastedId] = pastedIds
    if (pastedId === undefined) throw new Error('Expected a pasted id')
    expect(pastedId).not.toBe(source)
    expect(getState().graph.nodes[pastedId]?.position).toEqual({ x: 45, y: 45 })
    expect(getState().selectedNodeIds).toEqual(pastedIds)
    expect(historyLength()).toBe(entriesBefore + 1)
  })

  describe('property readers', () => {
    const READER_NODE = 'test/property-reader'
    registry.register(
      defineNode({
        type: READER_NODE,
        category: 'input',
        label: 'Property reader',
        description: 'Reads a property',
        keywords: [],
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
        params: [
          { id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true },
        ],
        reads: 'property',
        build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
      }),
    )

    const readerFragment = (): GraphFragment => ({
      kind: 'nudo-tsl/fragment',
      schemaVersion: 1,
      nodes: [
        {
          id: asNodeId('reader'),
          type: READER_NODE,
          position: ORIGIN,
          inputValues: {},
          params: { propertyId: 'ghost' },
        },
      ],
      edges: [],
    })

    it('skips readers of missing properties and shows an info notice', () => {
      const entriesBefore = historyLength()

      const pastedIds = getState().pasteFragment(readerFragment(), ORIGIN)

      expect(pastedIds).toEqual([])
      expect(Object.keys(getState().graph.nodes)).toEqual([MASTER_NODE_ID])
      expect(getState().notice).toEqual({
        kind: 'info',
        messageKey: 'notice.droppedReaders',
      })
      expect(historyLength()).toBe(entriesBefore)
    })

    it('shows no notice when nothing was skipped', () => {
      const source = addNodeOrFail(FLOAT_NODE)
      const sourceNode = getState().graph.nodes[source]
      if (sourceNode === undefined) throw new Error('Expected source node')

      getState().pasteFragment(
        { kind: 'nudo-tsl/fragment', schemaVersion: 1, nodes: [sourceNode], edges: [] },
        ORIGIN,
      )

      expect(getState().notice).toBeNull()
    })
  })
})

describe('removeSelection', () => {
  /** A float node feeding Roughness and another feeding Metalness, so there are two edges. */
  function connectedPair(): { first: NodeId; second: NodeId } {
    const first = addNodeOrFail(FLOAT_NODE)
    const second = addNodeOrFail(FLOAT_NODE)
    getState().connect(
      { nodeId: first, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    )
    getState().connect(
      { nodeId: second, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'metalness' },
    )
    return { first, second }
  }

  it('removes nodes and edges together as one undoable history entry', () => {
    const { first, second } = connectedPair()
    const connectedGraph = getState().graph
    const [firstEdge] = Object.values(connectedGraph.edges).filter(
      (edge) => edge.from.nodeId === first,
    )
    if (firstEdge === undefined) throw new Error('Expected an edge from the first node')
    const entriesBefore = historyLength()

    getState().removeSelection([second], [firstEdge.id])

    expect(getState().graph.nodes[second]).toBeUndefined()
    expect(getState().graph.nodes[first]).toBeDefined()
    expect(Object.keys(getState().graph.edges)).toHaveLength(0)
    expect(historyLength()).toBe(entriesBefore + 1)

    undo()
    expect(getState().graph).toBe(connectedGraph)
  })

  it('removes only edges when no node is given', () => {
    const { first } = connectedPair()
    const edgeIds = Object.values(getState().graph.edges).map((edge) => edge.id)
    const entriesBefore = historyLength()

    getState().removeSelection([], edgeIds)

    expect(Object.keys(getState().graph.edges)).toHaveLength(0)
    expect(getState().graph.nodes[first]).toBeDefined()
    expect(historyLength()).toBe(entriesBefore + 1)
  })

  it('keeps the master, shows the notice and still removes the other nodes', () => {
    const id = addNodeOrFail(FLOAT_NODE)

    getState().removeSelection([MASTER_NODE_ID, id], [])

    expect(getState().graph.nodes[MASTER_NODE_ID]).toBeDefined()
    expect(getState().graph.nodes[id]).toBeUndefined()
    expect(getState().notice).toEqual({
      kind: 'info',
      messageKey: 'notice.masterDelete',
    })
  })

  it('on the master alone shows the notice and creates no history entry', () => {
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    getState().removeSelection([MASTER_NODE_ID], [])

    expect(getState().graph).toBe(graphBefore)
    expect(getState().notice?.messageKey).toBe('notice.masterDelete')
    expect(historyLength()).toBe(entriesBefore)
  })

  it('ignores ids that are not in the graph', () => {
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    getState().removeSelection([asNodeId('ghost')], [asEdgeId('ghost-edge')])

    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(entriesBefore)
  })
})

describe('compile errors', () => {
  it('setCompileErrors indexes messages by node id', () => {
    const nodeId = asNodeId('n1')

    getState().setCompileErrors([{ nodeId, code: 'build-failed', message: 'boom' }])
    expect(getState().errorsByNode).toEqual({ [nodeId]: 'boom' })

    getState().setCompileErrors([])
    expect(getState().errorsByNode).toEqual({})
  })
})

describe('insertReroute', () => {
  function connectedFloat(): { nodeId: NodeId; edgeId: string } {
    const nodeId = addNodeOrFail(FLOAT_NODE)
    getState().connect({ nodeId, portId: 'out' }, { nodeId: MASTER_NODE_ID, portId: 'roughness' })
    const [edgeId] = Object.keys(getState().graph.edges)
    if (edgeId === undefined) throw new Error('No edge was made')
    return { nodeId, edgeId }
  }

  it('splits the connection around a selected reroute, as one history entry', () => {
    const { nodeId, edgeId } = connectedFloat()
    const before = historyLength()

    const rerouteId = getState().insertReroute(asEdgeId(edgeId), { x: 40, y: 50 })

    expect(rerouteId).not.toBeNull()
    const { graph } = getState()
    expect(rerouteId === null ? undefined : graph.nodes[rerouteId]).toMatchObject({
      type: 'utility/reroute',
      position: { x: 40, y: 50 },
    })
    expect(Object.values(graph.edges).map((edge) => [edge.from.nodeId, edge.to.nodeId])).toEqual([
      [nodeId, rerouteId],
      [rerouteId, MASTER_NODE_ID],
    ])
    expect(getState().selectedNodeIds).toEqual([rerouteId])
    expect(historyLength()).toBe(before + 1)
  })

  it('leaves the graph alone and tells why when the connection is gone', () => {
    connectedFloat()
    const graph = getState().graph

    expect(getState().insertReroute(asEdgeId('missing'), ORIGIN)).toBeNull()
    expect(getState().graph).toBe(graph)
    expect(getState().notice).toEqual({ kind: 'error', messageKey: 'notice.rerouteFailed' })
  })
})
