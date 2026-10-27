import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { useEditorStore } from '@/store/editor-store'

import { SPLIT_PERCENT_MAX, SPLIT_PERCENT_MIN, SPLIT_PERCENT_STEP } from './panel-state'

const PERCENT = 100

/** Where each key moves the divider, from the current share of the canvas. */
function keyedPercent(key: string, percent: number): number | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return percent - SPLIT_PERCENT_STEP
    case 'ArrowRight':
    case 'ArrowUp':
      return percent + SPLIT_PERCENT_STEP
    case 'Home':
      return SPLIT_PERCENT_MIN
    case 'End':
      return SPLIT_PERCENT_MAX
    default:
      return null
  }
}

export interface SplitDividerProps {
  /** Id of the preview panel the divider resizes. */
  controlsId: string
}

/**
 * The window splitter between the canvas and the preview (APG window splitter): drag it, or focus
 * it and use the arrow keys (5% a press), Home and End. Its value is the canvas share, 25–75%.
 */
export function SplitDivider({ controlsId }: SplitDividerProps) {
  const percent = useEditorStore((state) => state.splitDraftPercent ?? state.panels.splitPercent)
  const isDragging = useRef(false)

  // A key press is one deliberate step, so it is stored (and persisted) at once.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = keyedPercent(event.key, percent)
    if (next === null) return
    event.preventDefault()
    useEditorStore.getState().setSplitPercent(next)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDragging.current = true
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isDragging.current) return
    const workspace = event.currentTarget.parentElement?.getBoundingClientRect()
    if (workspace === undefined || workspace.width === 0) return
    // A drag only drafts the split; it is stored once, on release.
    useEditorStore
      .getState()
      .draftSplitPercent(((event.clientX - workspace.left) / workspace.width) * PERCENT)
  }

  const endDrag = (): void => {
    if (!isDragging.current) return
    isDragging.current = false
    useEditorStore.getState().commitSplitDraft()
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="Resize preview"
      aria-orientation="vertical"
      aria-controls={controlsId}
      aria-valuenow={percent}
      aria-valuemin={SPLIT_PERCENT_MIN}
      aria-valuemax={SPLIT_PERCENT_MAX}
      aria-valuetext={`Canvas ${String(percent)}%, preview ${String(PERCENT - percent)}%`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group relative z-20 flex cursor-col-resize touch-none justify-center"
    >
      <span
        aria-hidden="true"
        className="h-full w-px bg-border transition-colors group-hover:bg-muted-foreground group-active:bg-primary"
      />
    </div>
  )
}
