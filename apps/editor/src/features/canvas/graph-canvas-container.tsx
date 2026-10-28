import { useCallback, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { asEdgeId, asNodeId, checkConnection, resolvePortTypes } from '@nudo-tsl/core'
import type { EdgeId, PortRef, XY } from '@nudo-tsl/core'
import type {
  Dimensions,
  EdgeMouseHandler,
  IsValidConnection,
  OnConnect,
  OnDelete,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'

import { useOpenAddNodeMenu } from '@/features/add-node-menu/add-node-menu-context'
import { addPropertyToCanvas } from '@/features/blackboard/add-property-to-canvas'
import { carriesProperty, droppedPropertyId } from '@/features/blackboard/property-drag'
import { pasteFromClipboard } from '@/features/shortcuts/clipboard'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

import { chainClassOf, selectionChain } from './chain-highlight'
import { listConnectCandidates, edgesAttachedTo } from './connect-candidates'
import { focusFlowNode } from './focus-flow-node'
import { GraphCanvas } from './graph-canvas'
import { GraphCanvasActionsContext } from './graph-canvas-actions'
import type { GraphCanvasActions } from './graph-canvas-actions'
import { NodeFieldActionsContext } from './node-field-actions'
import { storeFieldActions } from './store-field-actions'
import { interpretEdgeChanges, interpretNodeChanges, planDeletion } from './interpret-flow-changes'
import { REROUTE_SIZE } from './reroute-node-view'
import { COMMENT_NODE_TYPE, COMMENT_TYPE, toFlow } from './to-flow'
import { useCanvasKeyboard } from './use-canvas-keyboard'
import type { FlowEdge, FlowNode } from './to-flow'

/** What `Connection` and `FlowEdge` share: React Flow validates both shapes. */
interface FlowConnection {
  readonly source: string
  readonly target: string
  readonly sourceHandle?: string | null
  readonly targetHandle?: string | null
}

function toPortRefs(connection: FlowConnection): { from: PortRef; to: PortRef } | null {
  const { source, sourceHandle, target, targetHandle } = connection
  if (sourceHandle == null || targetHandle == null) return null
  return {
    from: { nodeId: asNodeId(source), portId: sourceHandle },
    to: { nodeId: asNodeId(target), portId: targetHandle },
  }
}

const getStore = () => useEditorStore.getState()

/** Adds a reroute centered on a flow point, splitting the connection, and focuses it. */
function insertRerouteAt(edgeId: EdgeId, center: XY): void {
  const position = { x: center.x - REROUTE_SIZE.width / 2, y: center.y - REROUTE_SIZE.height / 2 }
  const nodeId = getStore().insertReroute(edgeId, position)
  if (nodeId !== null) focusFlowNode(nodeId)
}

function withoutKeys<T>(record: Readonly<Record<string, T>>, keys: readonly string[]) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
}

/** A resize ends with the final size; the position is the draft the resize left behind. */
function commitEndedResizes(endedResizes: Readonly<Record<string, Dimensions>>): void {
  const store = getStore()
  for (const [id, size] of Object.entries(endedResizes)) {
    const nodeId = asNodeId(id)
    const position = store.draftPositions[nodeId] ?? store.graph.nodes[nodeId]?.position
    if (position !== undefined) store.commitResize(nodeId, { position, ...size })
  }
}

/** Connects the store to the presentational canvas. React Flow state is derived, never owned. */
export function GraphCanvasContainer() {
  const graph = useEditorStore((state) => state.graph)
  const draftPositions = useEditorStore((state) => state.draftPositions)
  const errorsByNode = useEditorStore((state) => state.errorsByNode)
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds)
  // React Flow view state: measured sizes keep handles and edges placed between renders.
  const [measured, setMeasured] = useState<Readonly<Record<string, Dimensions>>>({})
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<readonly string[]>([])
  // Live sizes while a comment frame's resizer is dragged; the store gets the final one.
  const [draftSizes, setDraftSizes] = useState<Readonly<Record<string, Dimensions>>>({})

  const types = useMemo(() => resolvePortTypes(graph, registry), [graph])
  // A node being dragged (or nudged, or tidied into place) shows no chain: it would flicker.
  const isMoving = Object.keys(draftPositions).length > 0
  const chain = useMemo(
    () => (isMoving ? null : selectionChain(graph, selectedNodeIds)),
    [graph, selectedNodeIds, isMoving],
  )
  const flow = useMemo(
    () => toFlow(graph, registry, types, draftPositions, errorsByNode, selectedNodeIds),
    [graph, types, draftPositions, errorsByNode, selectedNodeIds],
  )
  const nodes = useMemo(
    () =>
      flow.nodes.map((node) => {
        const size = measured[node.id]
        const draftSize = draftSizes[node.id]
        const sized = draftSize === undefined ? node : { ...node, ...draftSize }
        // Comment frames sit behind everything and are never dimmed.
        const className =
          node.type === COMMENT_NODE_TYPE ? undefined : chainClassOf(chain, 'node', node.id)
        const highlighted = className === undefined ? sized : { ...sized, className }
        return size === undefined ? highlighted : { ...highlighted, measured: size }
      }),
    [flow.nodes, measured, draftSizes, chain],
  )
  const edges = useMemo(
    () =>
      flow.edges.map((edge) => {
        const className = chainClassOf(chain, 'edge', edge.id)
        const highlighted = className === undefined ? edge : { ...edge, className }
        return selectedEdgeIds.includes(edge.id) ? { ...highlighted, selected: true } : highlighted
      }),
    [flow.edges, selectedEdgeIds, chain],
  )

  const onNodesChange = useCallback<OnNodesChange<FlowNode>>((changes) => {
    const store = getStore()
    const intent = interpretNodeChanges(changes, store)
    if (Object.keys(intent.dimensions).length > 0) {
      setMeasured((current) => ({ ...current, ...intent.dimensions }))
    }
    if (Object.keys(intent.draftSizes).length > 0) {
      setDraftSizes((current) => ({ ...current, ...intent.draftSizes }))
    }
    if (intent.draftPositions !== null) store.setDraftPositions(intent.draftPositions)
    if (intent.committedPositions !== null) store.commitMove(intent.committedPositions)
    commitEndedResizes(intent.endedResizes)
    if (Object.keys(intent.endedResizes).length > 0) {
      setDraftSizes((current) => withoutKeys(current, Object.keys(intent.endedResizes)))
    }
    if (intent.selection !== null) store.setSelection(intent.selection)
  }, [])

  const onEdgesChange = useCallback<OnEdgesChange<FlowEdge>>((changes) => {
    setSelectedEdgeIds((current) => interpretEdgeChanges(changes, current) ?? current)
  }, [])

  const onConnect = useCallback<OnConnect>((connection) => {
    const refs = toPortRefs(connection)
    if (refs !== null) getStore().connect(refs.from, refs.to)
  }, [])

  const onDelete = useCallback<OnDelete<FlowNode, FlowEdge>>(({ nodes: removed, edges: cut }) => {
    const plan = planDeletion(removed, cut)
    getStore().removeSelection(plan.nodeIds, plan.edgeIds)
  }, [])

  const isValidConnection = useCallback<IsValidConnection<FlowEdge>>((connection) => {
    const refs = toPortRefs(connection)
    if (refs === null) return false
    return checkConnection(getStore().graph, registry, refs.from, refs.to).ok
  }, [])

  const openAddNodeMenu = useOpenAddNodeMenu()
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>()

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler<FlowEdge>>(
    (event, edge) => {
      insertRerouteAt(
        asEdgeId(edge.id),
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      )
    },
    [screenToFlowPosition],
  )

  useCanvasKeyboard(selectedEdgeIds)

  const onDragOver = useCallback((event: DragEvent) => {
    if (!carriesProperty(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  /** A property row dropped on the canvas becomes its reader node, at the drop point. */
  const onDrop = useCallback(
    (event: DragEvent) => {
      const propertyId = droppedPropertyId(event.dataTransfer)
      if (propertyId === null) return
      event.preventDefault()
      addPropertyToCanvas(propertyId, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [screenToFlowPosition],
  )

  const actions = useMemo<GraphCanvasActions>(
    () => ({
      ...storeFieldActions,
      listConnectCandidates: (origin) => listConnectCandidates(getStore().graph, registry, origin),
      connectPorts: (origin, target) => {
        const [from, to] = origin.side === 'output' ? [origin.ref, target] : [target, origin.ref]
        getStore().connect(from, to)
      },
      disconnectPort: (origin) => {
        getStore().disconnect(edgesAttachedTo(getStore().graph, origin))
      },
      deleteEdge: (edgeId) => {
        getStore().removeSelection([], [edgeId])
        focusOpenerOrCanvas(null)
      },
      insertRerouteAt,
      pasteAt: (point) => {
        void pasteFromClipboard(screenToFlowPosition({ x: point.clientX, y: point.clientY }))
      },
      addCommentAt: (point) => {
        const store = getStore()
        const position = screenToFlowPosition({ x: point.clientX, y: point.clientY })
        const nodeId = store.addNode(COMMENT_TYPE, position)
        if (nodeId === null) return
        store.setSelection([nodeId])
        focusFlowNode(nodeId)
      },
      openAddNodeMenuAt: (point) => {
        openAddNodeMenu({ kind: 'cursor', ...point }, null)
      },
    }),
    [screenToFlowPosition, openAddNodeMenu],
  )

  return (
    <GraphCanvasActionsContext value={actions}>
      <NodeFieldActionsContext value={actions}>
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDelete={onDelete}
          isValidConnection={isValidConnection}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      </NodeFieldActionsContext>
    </GraphCanvasActionsContext>
  )
}
