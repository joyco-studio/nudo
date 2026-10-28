import { useCallback, useEffect, useRef } from 'react'
import { asNodeId } from '@nudo-tsl/core'
import type { NodeId, XY } from '@nudo-tsl/core'
import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react'
import type { InternalNode, Viewport } from '@xyflow/react'
import { animate, useReducedMotion } from 'motion/react'
import type { AnimationPlaybackControls } from 'motion/react'

import { NEW_NODE_SIZE } from '@/features/add-node-menu/add-node-placement'
import { isKeyboardModality } from '@/shared/lib/input-modality'
import { DURATION_MS, EASE, toSeconds } from '@/shared/motion/tokens'
import { useEditorStore } from '@/store/editor-store'

import { fitViewOptionsFor } from '../fit-view-options'
import { measureCanvasArea } from '../measure-canvas-insets'
import { COMMENT_NODE_TYPE } from '../to-flow'
import type { FlowNode } from '../to-flow'
import { boundsOf } from './bounds'
import type { Bounds } from './bounds'
import { planTidyUp } from './plan-tidy-up'
import type { NodeGeometry, TidyPlan } from './plan-tidy-up'

export type TidyTarget = 'graph' | 'selection'

const getStore = () => useEditorStore.getState()

type HandleBounds = NonNullable<InternalNode<FlowNode>['internals']['handleBounds']>

/** The middle of each handle below the node's top, by port id. */
function handleMiddles(handles: HandleBounds['source']): Record<string, number> {
  return Object.fromEntries(
    (handles ?? []).flatMap((handle) =>
      handle.id == null ? [] : [[handle.id, handle.y + handle.height / 2]],
    ),
  )
}

function geometryOf(node: InternalNode<FlowNode>, position: XY): NodeGeometry {
  const handles = node.internals.handleBounds
  return {
    id: node.data.node.id,
    position,
    width: node.measured.width ?? node.width ?? NEW_NODE_SIZE.width,
    height: node.measured.height ?? node.height ?? NEW_NODE_SIZE.height,
    isFrame: node.type === COMMENT_NODE_TYPE,
    inputY: handleMiddles(handles?.target ?? null),
    outputY: handleMiddles(handles?.source ?? null),
  }
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** Each planned node's position `progress` of the way from where it was to where it goes. */
function positionsAt(from: TidyPlan, to: TidyPlan, progress: number): TidyPlan {
  const positions: Partial<Record<NodeId, XY>> = {}
  for (const [key, target] of Object.entries(to)) {
    const id = asNodeId(key)
    const start = from[id]
    if (target === undefined || start === undefined) continue
    positions[id] = { x: lerp(start.x, target.x, progress), y: lerp(start.y, target.y, progress) }
  }
  return positions
}

function viewportAt(from: Viewport, to: Viewport, progress: number): Viewport {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    zoom: lerp(from.zoom, to.zoom, progress),
  }
}

/**
 * Where each planned node starts from: where it shows now, a draft when a glide is under way,
 * else its place in the graph.
 */
function startingPositions(plan: TidyPlan): TidyPlan {
  const { graph, draftPositions } = getStore()
  return Object.fromEntries(
    Object.keys(plan).flatMap((key) => {
      const id = asNodeId(key)
      const position = draftPositions[id] ?? graph.nodes[id]?.position
      return position === undefined ? [] : [[key, position]]
    }),
  )
}

/** The bounds of every node once the plan has moved them, in flow units. */
function boundsAfter(geometry: readonly NodeGeometry[], plan: TidyPlan): Bounds {
  return boundsOf(geometry.map((item) => ({ ...item, position: plan[item.id] ?? item.position })))
}

/**
 * Tidies the graph, or the selected nodes, into a layered layout (see `plan-tidy-up`) as one
 * history entry. Tidying the graph also fits it into the view, clear of the panels. From a pointer
 * the nodes (and the view) glide there on the motion tokens; from the keyboard, or with reduced
 * motion, they move at once. Must be used inside a `ReactFlowProvider`.
 */
export function useTidyUp(): (target: TidyTarget) => void {
  const { getNodes, getInternalNode, getViewport, setViewport } = useReactFlow<FlowNode>()
  const flowStore = useStoreApi<FlowNode>()
  const prefersReducedMotion = useReducedMotion() === true
  /** Stops the glide under way, if any, and drops its drafts. */
  const stopGlideRef = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      stopGlideRef.current?.()
    },
    [],
  )

  const fittedViewport = useCallback(
    (geometry: readonly NodeGeometry[], plan: TidyPlan): Viewport => {
      const { rect, insets } = measureCanvasArea()
      const width = rect.right - rect.left
      const height = rect.bottom - rect.top
      const options = fitViewOptionsFor(width, insets)
      const { minZoom, maxZoom } = flowStore.getState()
      return getViewportForBounds(
        boundsAfter(geometry, plan),
        width,
        height,
        options.minZoom ?? minZoom,
        options.maxZoom ?? maxZoom,
        options.padding ?? 0,
      )
    },
    [flowStore],
  )

  return useCallback(
    (target) => {
      const store = getStore()
      const geometry = getNodes().flatMap((node) => {
        const internal = getInternalNode(node.id)
        const stored = store.graph.nodes[asNodeId(node.id)]
        return internal === undefined || stored === undefined
          ? []
          : [geometryOf(internal, stored.position)]
      })
      const plan = planTidyUp(
        Object.values(store.graph.edges),
        geometry,
        target === 'graph'
          ? { kind: 'graph' }
          : { kind: 'selection', nodeIds: store.selectedNodeIds },
      )
      if (Object.keys(plan).length === 0) return

      // Read before the running glide stops: a new glide starts from what is on screen.
      const start = startingPositions(plan)
      stopGlideRef.current?.()
      const finalViewport = target === 'graph' ? fittedViewport(geometry, plan) : null
      store.commitMove(plan)
      if (prefersReducedMotion || isKeyboardModality(document)) {
        if (finalViewport !== null) void setViewport(finalViewport)
        return
      }

      // The graph already holds the result (one undo step); drafts only show the way there.
      const tidied = getStore().graph
      const startViewport = getViewport()
      store.setDraftPositions(start)
      let controls: AnimationPlaybackControls | null = null
      // motion can still deliver a frame it had queued when the glide stopped: ignore it.
      let isStopped = false
      // Undo, redo or any other change to the graph ends the glide where the graph now is.
      const unsubscribe = useEditorStore.subscribe((state) => {
        if (state.graph !== tidied) stopGlide()
      })
      const stopGlide = (): void => {
        isStopped = true
        controls?.stop()
        unsubscribe()
        stopGlideRef.current = null
        getStore().setDraftPositions({})
      }
      stopGlideRef.current = stopGlide
      controls = animate(0, 1, {
        duration: toSeconds(DURATION_MS.medium),
        ease: EASE.smoothOut,
        onUpdate: (progress) => {
          if (isStopped) return
          getStore().setDraftPositions(positionsAt(start, plan, progress))
          if (finalViewport !== null) {
            void setViewport(viewportAt(startViewport, finalViewport, progress))
          }
        },
        onComplete: stopGlide,
      })
    },
    [getNodes, getInternalNode, getViewport, setViewport, fittedViewport, prefersReducedMotion],
  )
}
