import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { GroupImperativeHandle, Layout, LayoutChangedMeta } from 'react-resizable-panels'

import { useEditorStore } from '@/store/editor-store'

import { FULL_PERCENT, SPLIT_PERCENT_MAX, SPLIT_PERCENT_MIN } from './panel-state'

export const CANVAS_PANEL_ID = 'canvas'
export const PREVIEW_PANEL_ID = 'preview'

/** Panel limits as percentages of the workspace (unitless strings, in the library's terms). */
export interface PanelLimits {
  readonly minSize: string
  readonly maxSize: string
}

const SPLIT_LIMITS: PanelLimits = {
  minSize: String(SPLIT_PERCENT_MIN),
  maxSize: String(SPLIT_PERCENT_MAX),
}
/** Outside split the canvas takes the whole row and the preview panel has no width. */
const CANVAS_ONLY_LIMITS: PanelLimits = {
  minSize: String(FULL_PERCENT),
  maxSize: String(FULL_PERCENT),
}
const COLLAPSED_LIMITS: PanelLimits = { minSize: '0', maxSize: '0' }

function layoutFor(isSplit: boolean, canvasPercent: number): Layout {
  return isSplit
    ? { [CANVAS_PANEL_ID]: canvasPercent, [PREVIEW_PANEL_ID]: FULL_PERCENT - canvasPercent }
    : { [CANVAS_PANEL_ID]: FULL_PERCENT, [PREVIEW_PANEL_ID]: 0 }
}

export interface SplitLayout {
  groupRef: RefObject<GroupImperativeHandle | null>
  defaultLayout: Layout
  canvasLimits: PanelLimits
  previewLimits: PanelLimits
  onLayoutChange: (layout: Layout) => void
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void
}

const getStore = () => useEditorStore.getState()

/**
 * Drives the resizable canvas/preview group from the stored layout. In split the canvas keeps
 * 25–75% of the width; otherwise the preview panel has none (the docked and full preview float
 * over the workspace instead). A drag only drafts the split; it is stored once, on release, and a
 * key press is stored at once.
 */
export function useSplitLayout(isSplit: boolean): SplitLayout {
  const groupRef = useRef<GroupImperativeHandle | null>(null)
  const [defaultLayout] = useState(() => layoutFor(isSplit, getStore().panels.splitPercent))

  // Entering or leaving split moves the panels to the stored split, or gives the canvas everything.
  // It waits a frame: the panels register their new limits first, and the library clamps the
  // layout to them on its own, which would undo a layout set earlier.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      groupRef.current?.setLayout(layoutFor(isSplit, getStore().panels.splitPercent))
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [isSplit])

  return {
    groupRef,
    defaultLayout,
    canvasLimits: isSplit ? SPLIT_LIMITS : CANVAS_ONLY_LIMITS,
    previewLimits: isSplit ? SPLIT_LIMITS : COLLAPSED_LIMITS,
    onLayoutChange: (layout) => {
      const canvasPercent = layout[CANVAS_PANEL_ID]
      if (isSplit && canvasPercent !== undefined) getStore().draftSplitPercent(canvasPercent)
    },
    onLayoutChanged: (_layout, meta) => {
      if (isSplit && meta.isUserInteraction) getStore().commitSplitDraft()
      else getStore().discardSplitDraft()
    },
  }
}
