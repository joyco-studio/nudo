import { useCallback } from 'react'
import type { XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { COMMENT_NODE_TYPE } from '@/features/canvas/to-flow'
import type { FlowNode } from '@/features/canvas/to-flow'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'

import { NEW_NODE_SIZE, besideNode, findFreeSpot, rectCenter } from './add-node-placement'
import type { FlowRect, PlacementOrigin } from './add-node-placement'

/** Turns where a new node is asked for into a flow position. */
export type ResolvePlacement = (origin: PlacementOrigin) => XY

function canvasElement(): HTMLElement | null {
  return document.getElementById(CANVAS_ID)
}

/** Screen point at the middle of the canvas, or the window when the canvas isn't mounted. */
function viewportCenter(): XY {
  const rect = canvasElement()?.getBoundingClientRect()
  return rectCenter(
    rect ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
  )
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
