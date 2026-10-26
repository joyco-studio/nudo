import type { EditorSliceCreator, UiSlice } from './store-types'

export const createUiSlice: EditorSliceCreator<UiSlice> = (set) => ({
  selectedNodeIds: [],
  draftPositions: {},
  notice: null,
  setSelection: (ids) => {
    set({ selectedNodeIds: ids })
  },
  setDraftPositions: (positions) => {
    set({ draftPositions: positions })
  },
  showNotice: (notice) => {
    set({ notice })
  },
  dismissNotice: () => {
    set({ notice: null })
  },
})
