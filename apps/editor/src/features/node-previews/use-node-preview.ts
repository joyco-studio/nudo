import { useCallback, useState } from 'react'
import type { RefCallback } from 'react'
import type { NodeId } from '@nudo-tsl/core'

import type { NodePreviewSnapshot } from './preview-engine'
import { getSharedPreviewEngine } from './shared-preview-engine'

/**
 * Starts drawing a little before a preview scrolls into view, so panning reveals finished frames
 * instead of blank squares.
 */
const VISIBILITY_MARGIN = '64px'

export interface NodePreview {
  /** Attach to the node's canvas: the engine draws into it while it is mounted and on screen. */
  canvasRef: RefCallback<HTMLCanvasElement>
  /** What the canvas shows; `null` until the canvas is mounted. */
  snapshot: NodePreviewSnapshot | null
}

/**
 * Registers a node output with the shared preview engine for as long as its canvas is mounted,
 * and tells the engine when the canvas enters or leaves the viewport (the canvas pane clips it).
 */
export function useNodePreview(nodeId: NodeId, portId: string): NodePreview {
  const [snapshot, setSnapshot] = useState<NodePreviewSnapshot | null>(null)

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas === null) return
      const engine = getSharedPreviewEngine()
      const unregister = engine.register({ nodeId, portId }, canvas, setSnapshot)
      const observer = new IntersectionObserver(
        (records) => {
          const latest = records.at(-1)
          if (latest !== undefined) engine.setVisible(nodeId, latest.isIntersecting)
        },
        { rootMargin: VISIBILITY_MARGIN },
      )
      observer.observe(canvas)
      return () => {
        observer.disconnect()
        unregister()
        setSnapshot(null)
      }
    },
    [nodeId, portId],
  )

  return { canvasRef, snapshot }
}
