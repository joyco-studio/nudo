import { useState } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import type {
  EdgeTypes,
  FitViewOptions,
  IsValidConnection,
  NodeTypes,
  OnConnect,
  OnDelete,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'

import { NodeView } from './node-view'
import { TypedEdge } from './typed-edge'
import { GRAPH_NODE_TYPE, TYPED_EDGE_TYPE } from './to-flow'
import type { FlowEdge, FlowNode } from './to-flow'

import './graph-canvas.css'

const NODE_TYPES: NodeTypes = { [GRAPH_NODE_TYPE]: NodeView }
const EDGE_TYPES: EdgeTypes = { [TYPED_EDGE_TYPE]: TypedEdge }
const DELETE_KEYS = ['Backspace', 'Delete']
const GRID_GAP = 20
const MAX_FIT_ZOOM = 1
const MIN_NARROW_FIT_ZOOM = 0.75

/** Below this width the preview panel covers the canvas top instead of a right-hand column. */
const WIDE_VIEWPORT_PX = 768

/** Keeps fitted nodes clear of the floating header (top) and, when wide, the preview panel. */
function fitViewOptionsFor(viewportWidth: number): FitViewOptions<FlowNode> {
  if (viewportWidth < WIDE_VIEWPORT_PX) {
    // On a phone, keep fields legible and let the person pan rather than shrink everything.
    return { maxZoom: MAX_FIT_ZOOM, minZoom: MIN_NARROW_FIT_ZOOM, padding: '24px' }
  }
  return {
    maxZoom: MAX_FIT_ZOOM,
    padding: { top: '80px', right: '360px', bottom: '48px', left: '48px' },
  }
}

export interface GraphCanvasProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  onNodesChange: OnNodesChange<FlowNode>
  onEdgesChange: OnEdgesChange<FlowEdge>
  onConnect: OnConnect
  onDelete: OnDelete<FlowNode, FlowEdge>
  isValidConnection: IsValidConnection<FlowEdge>
}

export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  isValidConnection,
}: GraphCanvasProps) {
  const [fitViewOptions] = useState(() => fitViewOptionsFor(window.innerWidth))

  return (
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
      deleteKeyCode={DELETE_KEYS}
      fitView
      fitViewOptions={fitViewOptions}
    >
      <Background variant={BackgroundVariant.Dots} gap={GRID_GAP} size={1} color="var(--border)" />
      <Controls position="bottom-left" showInteractive={false} fitViewOptions={fitViewOptions} />
    </ReactFlow>
  )
}
