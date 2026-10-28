import { useEffect, useMemo } from 'react'
import type { DragEventHandler } from 'react'
import { Background, BackgroundVariant, ReactFlow } from '@xyflow/react'
import type {
  AriaLabelConfig,
  EdgeMouseHandler,
  EdgeTypes,
  IsValidConnection,
  NodeTypes,
  OnConnect,
  OnDelete,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'

import type { MessageKey, Translate } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { CanvasControls } from './canvas-controls'
import { CommentNodeView } from './comment-node-view'
import { NodeView } from './node-view'
import { PaneContextMenu } from './pane-context-menu'
import { RerouteNodeView } from './reroute-node-view'
import { TypedEdge } from './typed-edge'
import { usePanelAwareView } from './use-panel-aware-view'
import { COMMENT_NODE_TYPE, GRAPH_NODE_TYPE, REROUTE_NODE_TYPE, TYPED_EDGE_TYPE } from './to-flow'
import type { FlowEdge, FlowNode } from './to-flow'

import './graph-canvas.css'

const NODE_TYPES: NodeTypes = {
  [GRAPH_NODE_TYPE]: NodeView,
  [COMMENT_NODE_TYPE]: CommentNodeView,
  [REROUTE_NODE_TYPE]: RerouteNodeView,
}

/** React Flow's arrow-key directions, as its live region announces a moved node. */
function directionKey(direction: string): MessageKey | null {
  switch (direction) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return `canvas.direction.${direction}`
    default:
      return null
  }
}

/** React Flow's own screen reader texts (edge hints, the moved-node announcement), translated. */
function flowAriaLabels(t: Translate): Partial<AriaLabelConfig> {
  return {
    'node.a11yDescription.default': t('canvas.nodeDescription'),
    'node.a11yDescription.keyboardDisabled': t('canvas.nodeDescription'),
    'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => {
      const key = directionKey(direction)
      return t('canvas.nodeMoved', { direction: key === null ? direction : t(key), x, y })
    },
    'edge.a11yDescription.default': t('canvas.edgeDescription'),
  }
}
const EDGE_TYPES: EdgeTypes = { [TYPED_EDGE_TYPE]: TypedEdge }
const GRID_GAP = 20
/**
 * How far out the view zooms (React Flow stops at 0.5): far enough to fit a 25-node graph between
 * the panels on a laptop screen.
 */
const MIN_ZOOM = 0.2

export interface GraphCanvasProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  onNodesChange: OnNodesChange<FlowNode>
  onEdgesChange: OnEdgesChange<FlowEdge>
  onConnect: OnConnect
  onDelete: OnDelete<FlowNode, FlowEdge>
  isValidConnection: IsValidConnection<FlowEdge>
  /** A double click on a connection: it inserts a reroute there. */
  onEdgeDoubleClick: EdgeMouseHandler<FlowEdge>
  /** Something dragged over the canvas from outside it (a property row). */
  onDragOver: DragEventHandler
  onDrop: DragEventHandler
}

/**
 * Fits the graph clear of the panels once, on mount. React Flow queues the fit until it has
 * measured the nodes; the panels are measured now, when the whole shell has rendered.
 */
function InitialFit() {
  const { fitAll } = usePanelAwareView()
  useEffect(fitAll, [fitAll])
  return null
}

export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  isValidConnection,
  onEdgeDoubleClick,
  onDragOver,
  onDrop,
}: GraphCanvasProps) {
  const t = useT()
  const ariaLabelConfig = useMemo(() => flowAriaLabels(t), [t])

  return (
    <PaneContextMenu>
      <ReactFlow<FlowNode, FlowEdge>
        className="graph-canvas"
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        isValidConnection={isValidConnection}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        // Space belongs to the add-node menu, and Delete to the keyboard model (one history entry).
        deleteKeyCode={null}
        panActivationKeyCode={null}
        minZoom={MIN_ZOOM}
        ariaLabelConfig={ariaLabelConfig}
      >
        <InitialFit />
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_GAP}
          size={1}
          color="var(--border)"
        />
        <CanvasControls />
      </ReactFlow>
    </PaneContextMenu>
  )
}
