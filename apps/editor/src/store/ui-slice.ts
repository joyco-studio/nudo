import {
  DEFAULT_PANEL_PREFS,
  clampSplitPercent,
  effectivePreviewLayout,
  nextPreviewLayout,
} from '@/features/panels/panel-state'
import type { PanelPrefs, PreviewLayout } from '@/features/panels/panel-state'

import { DEFAULT_SHAPE } from '@/features/main-preview/preview-shape'

import type { EditorSliceCreator, UiSlice } from './store-types'

type LayoutState = Pick<UiSlice, 'panels' | 'layoutBeforeFull'>

/** Opens the preview on the chosen layout and remembers where to return from the full one. */
function withPreviewLayout(state: LayoutState, layout: PreviewLayout): LayoutState {
  const current = effectivePreviewLayout(state.panels)
  const layoutBeforeFull =
    layout === 'full' && current !== 'full' ? current : state.layoutBeforeFull
  return {
    panels: { ...state.panels, layout, open: { ...state.panels.open, preview: true } },
    layoutBeforeFull,
  }
}

function withPanels(state: LayoutState, changes: Partial<PanelPrefs>): Pick<UiSlice, 'panels'> {
  return { panels: { ...state.panels, ...changes } }
}

export const createUiSlice: EditorSliceCreator<UiSlice> = (set) => ({
  selectedNodeIds: [],
  draftPositions: {},
  inputPreview: null,
  propertyPreview: null,
  notice: null,
  panels: DEFAULT_PANEL_PREFS,
  layoutBeforeFull: 'docked',
  splitDraftPercent: null,
  previewShape: DEFAULT_SHAPE,
  setSelection: (ids) => {
    set({ selectedNodeIds: ids })
  },
  setDraftPositions: (positions) => {
    set({ draftPositions: positions })
  },
  previewInputValue: (ref, value) => {
    set({ inputPreview: { ref, value } })
  },
  clearInputPreview: () => {
    set({ inputPreview: null })
  },
  previewPropertyValue: (id, value) => {
    set({ propertyPreview: { id, value } })
  },
  clearPropertyPreview: () => {
    set({ propertyPreview: null })
  },
  showNotice: (notice) => {
    set({ notice })
  },
  dismissNotice: () => {
    set({ notice: null })
  },
  togglePanel: (id) => {
    set((state) =>
      withPanels(state, { open: { ...state.panels.open, [id]: !state.panels.open[id] } }),
    )
  },
  setPreviewLayout: (layout) => {
    set((state) => withPreviewLayout(state, layout))
  },
  cyclePreviewLayout: () => {
    // A collapsed preview shows docked, so cycling starts from what is on screen.
    set((state) =>
      withPreviewLayout(state, nextPreviewLayout(effectivePreviewLayout(state.panels))),
    )
  },
  exitFullPreview: () => {
    set((state) =>
      effectivePreviewLayout(state.panels) === 'full'
        ? withPreviewLayout(state, state.layoutBeforeFull)
        : state,
    )
  },
  setSplitPercent: (percent) => {
    set((state) => withPanels(state, { splitPercent: clampSplitPercent(percent) }))
  },
  draftSplitPercent: (percent) => {
    set({ splitDraftPercent: clampSplitPercent(percent) })
  },
  commitSplitDraft: () => {
    set((state) =>
      state.splitDraftPercent === null
        ? state
        : {
            ...withPanels(state, { splitPercent: state.splitDraftPercent }),
            splitDraftPercent: null,
          },
    )
  },
  discardSplitDraft: () => {
    set({ splitDraftPercent: null })
  },
  setPreviewBackdrop: (backdrop) => {
    set((state) => withPanels(state, { backdrop }))
  },
  setPreviewShape: (shape) => {
    set({ previewShape: shape })
  },
})
