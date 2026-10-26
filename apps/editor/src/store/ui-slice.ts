import type { EditorSliceCreator, UiSlice } from './store-types'

export const createUiSlice: EditorSliceCreator<UiSlice> = (set) => ({
  selectedNodeIds: [],
  draftPositions: {},
  inputPreview: null,
  notice: null,
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
  showNotice: (notice) => {
    set({ notice })
  },
  dismissNotice: () => {
    set({ notice: null })
  },
})
