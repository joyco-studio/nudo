import { useCallback } from 'react'
import type { XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { measureCanvasArea } from '@/features/canvas/measure-canvas-insets'
import { COMMENT_NODE_TYPE } from '@/features/canvas/to-flow'
import type { FlowNode } from '@/features/canvas/to-flow'
import { visibleCenter } from '@/features/canvas/viewport-insets'
import { useEditorStore } from '@/store/editor-store'

import { NEW_NODE_SIZE, besideNode, findFreeSpot } from './add-node-placement'
import type { FlowRect, PlacementOrigin } from './add-node-placement'

/** Turns where a new node is asked for into a flow position. */
export type ResolvePlacement = (origin: PlacementOrigin) => XY

/** Screen point at the middle of the canvas the floating panels leave uncovered. */
function viewportCenter(): XY {
  const { rect, insets } = measureCanvasArea()
  return visibleCenter(rect, insets)
}

/** The nodes a new node must not cover. Comment frames sit behind nodes, so they don't count. */
function occupiedRects(nodes: readonly FlowNode[]): FlowRect[] {
  return nodes
    .filter((node) => node.type !== COMMENT_NODE_TYPE)
    .map((node) => ({
      ...node.position,
      width: node.measured?.width ?? NEW_NODE_SIZE.width,
      height: node.measured?.height ?? NEW_NODE_SIZE.height,
    }))
}

/**
 * Where a new node goes: at a pointer (exactly there), or at the viewport center or beside a
 * node, moved clear of the nodes already on that spot. Must be used inside a `ReactFlowProvider`.
 */
export function useNodePlacement(): ResolvePlacement {
  const { screenToFlowPosition, getNodes } = useReactFlow<FlowNode>()

  return useCallback(
    (origin) => {
      if (origin.kind === 'cursor') {
        return screenToFlowPosition({ x: origin.clientX, y: origin.clientY })
      }
      const node =
        origin.kind === 'beside-node'
          ? useEditorStore.getState().graph.nodes[origin.nodeId]
          : undefined
      const wanted =
        node === undefined ? screenToFlowPosition(viewportCenter()) : besideNode(node.position)
      // Space and the header button aim at a spot; a node already there is skipped, not covered.
      return findFreeSpot(wanted, occupiedRects(getNodes()))
    },
    [screenToFlowPosition, getNodes],
  )
}
