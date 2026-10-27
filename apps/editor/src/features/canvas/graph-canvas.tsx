import { useState } from 'react'
import { Background, BackgroundVariant, ReactFlow } from '@xyflow/react'
import type {
  EdgeTypes,
  IsValidConnection,
  NodeTypes,
  OnConnect,
  OnDelete,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'

import { CanvasControls } from './canvas-controls'
import { CommentNodeView } from './comment-node-view'
import { fitViewOptionsFor } from './fit-view-options'
import { NodeView } from './node-view'
import { PaneContextMenu } from './pane-context-menu'
import { TypedEdge } from './typed-edge'
import { COMMENT_NODE_TYPE, GRAPH_NODE_TYPE, TYPED_EDGE_TYPE } from './to-flow'
import type { FlowEdge, FlowNode } from './to-flow'

import './graph-canvas.css'

const NODE_TYPES: NodeTypes = { [GRAPH_NODE_TYPE]: NodeView, [COMMENT_NODE_TYPE]: CommentNodeView }
const EDGE_TYPES: EdgeTypes = { [TYPED_EDGE_TYPE]: TypedEdge }
const GRID_GAP = 20

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
        // Space belongs to the add-node menu, and Delete to the keyboard model (one history entry).
        deleteKeyCode={null}
        panActivationKeyCode={null}
        fitView
        fitViewOptions={fitViewOptions}
      >
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
