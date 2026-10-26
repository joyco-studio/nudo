import { useCallback, useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { asNodeId, checkConnection, resolvePortTypes } from '@nudo-tsl/core'
import type { PortRef } from '@nudo-tsl/core'
import type {
  Dimensions,
  IsValidConnection,
  OnConnect,
  OnDelete,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'

import { useOpenAddNodeMenu } from '@/features/add-node-menu/add-node-menu-context'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

import { GraphCanvas } from './graph-canvas'
import { GraphCanvasActionsContext } from './graph-canvas-actions'
import type { GraphCanvasActions } from './graph-canvas-actions'
import { interpretEdgeChanges, interpretNodeChanges, planDeletion } from './interpret-flow-changes'
import { toFlow } from './to-flow'
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

/** Connects the store to the presentational canvas. React Flow state is derived, never owned. */
export function GraphCanvasContainer() {
  const graph = useEditorStore((state) => state.graph)
  const draftPositions = useEditorStore((state) => state.draftPositions)
  const errorsByNode = useEditorStore((state) => state.errorsByNode)
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds)
  // React Flow view state: measured sizes keep handles and edges placed between renders.
  const [measured, setMeasured] = useState<Readonly<Record<string, Dimensions>>>({})
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<readonly string[]>([])

  const types = useMemo(() => resolvePortTypes(graph, registry), [graph])
  const flow = useMemo(
    () => toFlow(graph, registry, types, draftPositions, errorsByNode, selectedNodeIds),
    [graph, types, draftPositions, errorsByNode, selectedNodeIds],
  )
  const nodes = useMemo(
    () =>
      flow.nodes.map((node) => {
        const size = measured[node.id]
        return size === undefined ? node : { ...node, measured: size }
      }),
    [flow.nodes, measured],
  )
  const edges = useMemo(
    () =>
      flow.edges.map((edge) =>
        selectedEdgeIds.includes(edge.id) ? { ...edge, selected: true } : edge,
      ),
    [flow.edges, selectedEdgeIds],
  )

  const onNodesChange = useCallback<OnNodesChange<FlowNode>>((changes) => {
    const store = getStore()
    const intent = interpretNodeChanges(changes, store)
    if (Object.keys(intent.dimensions).length > 0) {
      setMeasured((current) => ({ ...current, ...intent.dimensions }))
    }
    if (intent.draftPositions !== null) store.setDraftPositions(intent.draftPositions)
    if (intent.committedPositions !== null) store.commitMove(intent.committedPositions)
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
    const store = getStore()
    if (plan.edgeIds.length > 0) store.disconnect(plan.edgeIds)
    if (plan.nodeIds.length > 0) store.removeNodes(plan.nodeIds)
  }, [])

  const isValidConnection = useCallback<IsValidConnection<FlowEdge>>((connection) => {
    const refs = toPortRefs(connection)
    if (refs === null) return false
    return checkConnection(getStore().graph, registry, refs.from, refs.to).ok
  }, [])

  const openAddNodeMenu = useOpenAddNodeMenu()
  /** Right-click on empty canvas replaces the browser menu with the add-node menu, at the cursor. */
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent) => {
      event.preventDefault()
      openAddNodeMenu({ kind: 'cursor', clientX: event.clientX, clientY: event.clientY }, null)
    },
    [openAddNodeMenu],
  )

  const actions = useMemo<GraphCanvasActions>(
    () => ({
      setInputValue: (ref, value) => {
        getStore().setInputValue(ref, value)
      },
    }),
    [],
  )

  return (
    <GraphCanvasActionsContext value={actions}>
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        isValidConnection={isValidConnection}
        onPaneContextMenu={onPaneContextMenu}
      />
    </GraphCanvasActionsContext>
  )
}
