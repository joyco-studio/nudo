import {
  MASTER_NODE_ID,
  addNode,
  checkConnection,
  connect,
  createGraph,
  disconnect,
  moveNodes,
  pasteFragment,
  removeNodes,
  setInputValue,
} from '@nudo-tsl/core'
import type { ConnectionRejection, Graph, GraphError, NodeId, XY } from '@nudo-tsl/core'
import { createEdgeId, createNodeId } from './ids'
import { registry } from './registry'
import type { EditorSliceCreator, GraphSlice, Notice } from './store-types'

const MASTER_DELETE_NOTICE: Notice = { kind: 'info', message: "The Master Stack can't be deleted." }

const CONNECT_FAILED_NOTICE: Notice = { kind: 'error', message: "Couldn't connect those ports." }

/** Core `connect` re-checks the connection, so a failure here is almost always a rejection. */
function rejectionReason(error: GraphError): ConnectionRejection {
  return error.code === 'invalid-connection' ? error.reason : 'unknown-port'
}

/** Whether any of the requested positions differs from where the node already is. */
function hasMovement(graph: Graph, positions: Readonly<Partial<Record<NodeId, XY>>>): boolean {
  return Object.values(graph.nodes).some((node) => {
    const target = positions[node.id]
    return target !== undefined && (target.x !== node.position.x || target.y !== node.position.y)
  })
}

/** Core operations always return a new graph object, so compare what they could have removed. */
function hasGraphChanged(before: Graph, after: Graph): boolean {
  return (
    Object.keys(before.nodes).length !== Object.keys(after.nodes).length ||
    Object.keys(before.edges).length !== Object.keys(after.edges).length
  )
}

export const createGraphSlice: EditorSliceCreator<GraphSlice> = (set, get) => ({
  graph: createGraph(),

  addNode: (type, position) => {
    const id = createNodeId()
    const result = addNode(get().graph, registry, { id, type, position })
    if (!result.ok) return null
    set({ graph: result.value })
    return id
  },

  removeNodes: (ids) => {
    if (ids.includes(MASTER_NODE_ID)) {
      set({ notice: MASTER_DELETE_NOTICE })
      return
    }
    const result = removeNodes(get().graph, ids)
    if (!result.ok) return
    set({ graph: result.value })
  },

  removeSelection: (nodeIds, edgeIds) => {
    const removableIds = nodeIds.filter((id) => id !== MASTER_NODE_ID)
    if (removableIds.length < nodeIds.length) set({ notice: MASTER_DELETE_NOTICE })

    const { graph } = get()
    const knownIds = removableIds.filter((id) => graph.nodes[id] !== undefined)
    const withoutEdges = disconnect(graph, edgeIds)
    const result = removeNodes(withoutEdges, knownIds)
    if (!result.ok) return
    if (!hasGraphChanged(graph, result.value)) return
    set({ graph: result.value })
  },

  commitMove: (positions) => {
    const { graph } = get()
    if (!hasMovement(graph, positions)) {
      set({ draftPositions: {} })
      return
    }
    set({ graph: moveNodes(graph, positions), draftPositions: {} })
  },

  setInputValue: (ref, value) => {
    const result = setInputValue(get().graph, ref, value)
    if (!result.ok) return
    set({ graph: result.value })
  },

  connect: (from, to) => {
    const { graph } = get()
    const check = checkConnection(graph, registry, from, to)
    if (!check.ok) return check
    const result = connect(graph, registry, { id: createEdgeId(), from, to })
    if (!result.ok) {
      set({ notice: CONNECT_FAILED_NOTICE })
      return { ok: false, reason: rejectionReason(result.error) }
    }
    set({ graph: result.value })
    return check
  },

  disconnect: (edgeIds) => {
    const { graph } = get()
    const next = disconnect(graph, edgeIds)
    if (Object.keys(next.edges).length === Object.keys(graph.edges).length) return
    set({ graph: next })
  },

  pasteFragment: (fragment, offset) => {
    const { graph, pastedNodeIds } = pasteFragment(get().graph, fragment, {
      offset,
      createNodeId,
      createEdgeId,
    })
    if (pastedNodeIds.length === 0) return pastedNodeIds
    set({ graph, selectedNodeIds: pastedNodeIds })
    return pastedNodeIds
  },
})
