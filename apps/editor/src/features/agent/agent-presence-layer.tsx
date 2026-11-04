import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { NodeId, XY } from '@nudo-tsl/core'
import { useStore } from '@xyflow/react'
import type { InternalNode, ReactFlowState } from '@xyflow/react'
import { ArrowRight } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'

import { NEW_NODE_SIZE } from '@/features/add-node-menu/add-node-placement'
import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { measureCanvasArea } from '@/features/canvas/measure-canvas-insets'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'
import type { AgentPresence, AgentTask } from '@/store/store-types'

import { EDGE_INDICATOR_ATTRIBUTE, isCanvasPointShown } from './canvas-visibility'
import {
  cssPlacement,
  edgeIndicatorWithin,
  flowPointFor,
  flowToScreen,
  lookupFromNodes,
  sameXY,
  wirePath,
} from './presence-geometry'
import type {
  EdgeIndicator as EdgeIndicatorPlacement,
  PresenceNode,
  ViewTransform,
} from './presence-geometry'
import {
  currentStepOf,
  cursorTransitionFor,
  nextCursorMove,
  restingCursorMove,
  targetNodeId,
} from './presence-model'

/** How far in from the canvas border the off-screen pointer sits, in pixels. */
const EDGE_INDICATOR_INSET_PX = 28
/** React Flow places a flow point as-is when there is no pan or zoom. */
const NO_TRANSFORM: ViewTransform = { x: 0, y: 0, zoom: 1 }

function presenceNodeOf(node: InternalNode | undefined): PresenceNode | null {
  if (node === undefined) return null
  const bounds = node.internals.handleBounds
  const handles = [...(bounds?.source ?? []), ...(bounds?.target ?? [])].map((handle) => ({
    id: handle.id ?? null,
    x: handle.x,
    y: handle.y,
    width: handle.width,
    height: handle.height,
  }))
  return {
    position: node.internals.positionAbsolute,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
    handles,
  }
}

interface PresencePoints {
  /** Where the cursor points, in flow units. */
  readonly cursor: XY | null
  /** The port a pending wire leaves from, in flow units. */
  readonly wireFrom: XY | null
}

const samePoints = (a: PresencePoints, b: PresencePoints): boolean =>
  sameXY(a.cursor, b.cursor) && sameXY(a.wireFrom, b.wireFrom)

/** Resolves the presence against the rendered nodes; re-renders only when a point moves. */
function usePresencePoints(presence: AgentPresence): PresencePoints {
  const select = useCallback(
    (state: ReactFlowState): PresencePoints => {
      const lookup = lookupFromNodes(
        (nodeId) => presenceNodeOf(state.nodeLookup.get(nodeId)),
        NO_TRANSFORM,
      )
      const from = presence.pendingWire?.from
      return {
        cursor: flowPointFor(presence.target, lookup),
        wireFrom: from === undefined ? null : lookup.handleCenter(from),
      }
    },
    [presence],
  )
  return useStore(select, samePoints)
}

function useViewTransform(): ViewTransform {
  const x = useStore((state) => state.transform[0])
  const y = useStore((state) => state.transform[1])
  const zoom = useStore((state) => state.transform[2])
  return { x, y, zoom }
}

/** Where the cursor is drawn inside the panned layer, as motion values the wire can follow. */
interface CursorPosition {
  readonly x: MotionValue<number>
  readonly y: MotionValue<number>
}

/**
 * Glides the cursor to `offset` when it travels to a new target, else puts it there at once. A new
 * trip starts from wherever the cursor is, so a quick next step retargets instead of snapping.
 */
function useCursorPosition(offset: XY, travels: boolean): CursorPosition {
  const prefersReducedMotion = useReducedMotion() === true
  const x = useMotionValue(offset.x)
  const y = useMotionValue(offset.y)
  useLayoutEffect(() => {
    const transition = cursorTransitionFor(prefersReducedMotion, travels)
    if (transition.duration === 0) {
      x.jump(offset.x)
      y.jump(offset.y)
      return
    }
    const trips = [animate(x, offset.x, transition), animate(y, offset.y, transition)]
    return () => {
      for (const trip of trips) trip.stop()
    }
  }, [x, y, offset.x, offset.y, travels, prefersReducedMotion])
  return { x, y }
}

/** The wire the agent is dragging: from its port to the loose end, which rides on the cursor. */
function PendingWire({ from, cursor }: { from: XY; cursor: CursorPosition }) {
  const fromX = useMotionValue(from.x)
  const fromY = useMotionValue(from.y)
  useLayoutEffect(() => {
    fromX.jump(from.x)
    fromY.jump(from.y)
  }, [fromX, fromY, from.x, from.y])
  const path = useTransform(
    [fromX, fromY, cursor.x, cursor.y],
    ([startX = 0, startY = 0, endX = 0, endY = 0]: number[]) =>
      wirePath({ x: startX, y: startY }, { x: endX, y: endY }),
  )
  return (
    <svg className="absolute top-0 left-0 size-px overflow-visible">
      <motion.path
        d={path}
        className="fill-none stroke-agent"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
    </svg>
  )
}

/**
 * The arrow and name pill, with the wire it drags. The pan applies at once on the outer layer;
 * inside it the cursor glides only when the agent moves to a new target. A zoom or a dragged target
 * node moves it at once, so it never trails behind what it points at.
 */
function AgentCursor({
  point,
  wireFrom,
  target,
  name,
}: {
  point: XY
  wireFrom: XY | null
  target: AgentPresence['target']
  name: string
}) {
  const transform = useViewTransform()
  const offset = { x: point.x * transform.zoom, y: point.y * transform.zoom }
  const [move, setMove] = useState(() => restingCursorMove(target, offset))
  const next = nextCursorMove(move, target, offset)
  if (next !== move) setMove(next)
  const cursor = useCursorPosition(next.offset, next.travels)
  const placement = useTransform(
    [cursor.x, cursor.y],
    ([x = 0, y = 0]: number[]) => `translate(${String(x)}px, ${String(y)}px)`,
  )
  return (
    <div className="absolute top-0 left-0" style={{ transform: cssPlacement(transform) }}>
      {wireFrom !== null && (
        <PendingWire
          from={{ x: wireFrom.x * transform.zoom, y: wireFrom.y * transform.zoom }}
          cursor={cursor}
        />
      )}
      <motion.div
        data-agent-cursor
        className="absolute top-0 left-0 flex items-start gap-0.5 will-change-transform"
        style={{ transform: placement }}
      >
        <svg width="14" height="16" viewBox="0 0 14 16" className="fill-agent stroke-background">
          <path d="M1 1 L1 14 L4.5 10.5 L7 15 L9 14 L6.6 9.6 L12 9.6 Z" strokeWidth="1" />
        </svg>
        <span className="mt-3 bg-agent px-1.5 text-micro font-medium whitespace-nowrap text-agent-foreground">
          {name}
        </span>
      </motion.div>
    </div>
  )
}

/** The node the agent is about to add: a dashed, node-sized outline with its type. */
function GhostNode({ ghost }: { ghost: NonNullable<AgentPresence['ghost']> }) {
  const t = useT()
  const registry = useNodeRegistry()
  const transform = useViewTransform()
  const screen = flowToScreen(ghost.position, transform)
  const label = registry.get(ghost.type)?.label ?? ghost.type
  return (
    <div
      data-agent-ghost
      className="absolute top-0 left-0 origin-top-left border border-dashed border-agent bg-agent-soft"
      style={{
        width: NEW_NODE_SIZE.width,
        height: NEW_NODE_SIZE.height,
        transform: cssPlacement(screen, transform.zoom),
      }}
    >
      <div className="flex h-8 items-center justify-between gap-2 border-b border-dashed border-agent px-3">
        <span className="truncate font-heading text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <span className="shrink-0 text-micro text-muted-foreground">{t('agent.adding')}</span>
      </div>
    </div>
  )
}

function focusCanvas(): void {
  document.getElementById(CANVAS_ID)?.focus({ preventScroll: true })
}

/**
 * When the pointer goes away while focused (the agent came into view, or left), focus moves to the
 * canvas instead of falling to the page. Runs in the unmount cleanup, while the button is still in
 * the document and still focused.
 */
function useFocusCanvasOnUnmount<Element extends HTMLElement>() {
  const ref = useRef<Element>(null)
  useLayoutEffect(() => {
    const element = ref.current
    return () => {
      if (element !== null && document.activeElement === element) focusCanvas()
    }
  }, [])
  return ref
}

/** After the pan, focus lands on what the agent is working on, not on the vanished pointer. */
function focusTarget(target: AgentPresence['target']): void {
  const nodeId: NodeId | null = targetNodeId(target)
  if (nodeId !== null) {
    focusFlowNode(nodeId)
    return
  }
  focusCanvas()
}

/**
 * A pointer pinned to the canvas border toward an off-screen agent. It is the one control in the
 * presence: a native button, so Tab reaches it and Enter or Space pans the view to the agent.
 */
function EdgeIndicator({
  point,
  presence,
  name,
}: {
  point: XY
  presence: AgentPresence
  name: string
}) {
  const t = useT()
  const { centerOn } = usePanelAwareView()
  const transform = useViewTransform()
  const width = useStore((state) => state.width)
  const height = useStore((state) => state.height)
  // Measured at render: the pointer must clear the panels as they are now (collapsed or resized).
  const { rect, insets } = measureCanvasArea()
  const screen = flowToScreen(point, transform)
  // The insets are whole strips (the header's spans the width), so they only place the pointer;
  // whether the agent is in view is the browser's hit test, when it has one.
  const shown = isCanvasPointShown({ x: rect.left + screen.x, y: rect.top + screen.y })
  if (shown === true) return null
  const indicator = edgeIndicatorWithin(screen, { width, height }, insets, EDGE_INDICATOR_INSET_PX)
  if (indicator === null) return null
  return (
    <EdgeIndicatorButton
      indicator={indicator}
      label={t('agent.offscreen', { name })}
      name={name}
      onActivate={() => {
        centerOn(point)
        focusTarget(presence.target)
      }}
    />
  )
}

interface EdgeIndicatorButtonProps {
  indicator: EdgeIndicatorPlacement
  label: string
  name: string
  onActivate: () => void
}

function EdgeIndicatorButton({ indicator, label, name, onActivate }: EdgeIndicatorButtonProps) {
  const ref = useFocusCanvasOnUnmount<HTMLButtonElement>()
  return (
    <button
      ref={ref}
      {...{ [EDGE_INDICATOR_ATTRIBUTE]: '' }}
      type="button"
      aria-label={label}
      onClick={onActivate}
      className="pointer-events-auto absolute top-0 left-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-agent px-1.5 py-0.5 text-micro font-medium whitespace-nowrap text-agent-foreground outline-none focus-visible:ring-2 focus-visible:ring-agent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{ left: indicator.x, top: indicator.y }}
    >
      <ArrowRight
        aria-hidden="true"
        className="size-3"
        style={{ transform: `rotate(${String(indicator.angle)}deg)` }}
      />
      {name}
    </button>
  )
}

function PresenceScene({ presence, task }: { presence: AgentPresence; task: AgentTask }) {
  const points = usePresencePoints(presence)
  const name = task.agent.name
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0">
        {presence.ghost !== null && <GhostNode ghost={presence.ghost} />}
        {points.cursor !== null && (
          <AgentCursor
            point={points.cursor}
            wireFrom={points.wireFrom}
            target={presence.target}
            name={name}
          />
        )}
      </div>
      {points.cursor !== null && (
        <EdgeIndicator point={points.cursor} presence={presence} name={name} />
      )}
    </>
  )
}

/** Always mounted, so screen readers hear each step the agent moves to. */
function StepAnnouncer({ task }: { task: AgentTask | null }) {
  const t = useT()
  const current = currentStepOf(task)
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {current === null ? '' : t('agent.stepAnnouncement', current)}
    </span>
  )
}

/**
 * The agent working on the canvas: its cursor, the node it is adding, the wire it is drawing, and
 * a pointer at the border when it works out of view. Rendered inside the `ReactFlow`, over the
 * nodes (React Flow's renderer is z-index 4) and under its panels; it never takes the pointer.
 */
export function AgentPresenceLayer() {
  const presence = useEditorStore((state) => state.agentPresence)
  const task = useEditorStore((state) => state.agentTask)
  return (
    <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
      {presence !== null && task !== null && <PresenceScene presence={presence} task={task} />}
      <StepAnnouncer task={task} />
    </div>
  )
}
