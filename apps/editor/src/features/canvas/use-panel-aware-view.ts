import { useMemo } from 'react'
import type { XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { fitViewOptionsFor } from './fit-view-options'
import { measureCanvasArea } from './measure-canvas-insets'
import type { FlowNode } from './to-flow'
import { visibleCenterOffset } from './viewport-insets'

export interface PanelAwareView {
  /** Fits every node into the canvas the panels leave uncovered. */
  fitAll: () => void
  /** Fits the given nodes into the uncovered canvas. */
  frameNodes: (nodeIds: readonly string[]) => void
  /** Moves a flow point to the middle of the uncovered canvas, at the current zoom. */
  centerOn: (point: XY) => void
}

/**
 * View moves that treat the visible canvas as what the floating header and panels leave
 * uncovered, measured when each move runs. Must be used inside a `ReactFlowProvider`.
 */
export function usePanelAwareView(): PanelAwareView {
  const { fitView, getZoom, setCenter } = useReactFlow<FlowNode>()

  return useMemo<PanelAwareView>(() => {
    const currentOptions = () => {
      const { rect, insets } = measureCanvasArea()
      return fitViewOptionsFor(rect.right - rect.left, insets)
    }
    return {
      fitAll: () => {
        void fitView(currentOptions())
      },
      frameNodes: (nodeIds) => {
        void fitView({ ...currentOptions(), nodes: nodeIds.map((id) => ({ id })) })
      },
      centerOn: (point) => {
        const zoom = getZoom()
        const offset = visibleCenterOffset(measureCanvasArea().insets)
        // setCenter centers the whole canvas; shift so the point lands mid-way between the panels.
        void setCenter(point.x - offset.x / zoom, point.y - offset.y / zoom, { zoom })
      },
    }
  }, [fitView, getZoom, setCenter])
}
