import { useEditorStore } from '@/store/editor-store'

import type { NodeFieldActions } from './node-field-actions'

const getStore = () => useEditorStore.getState()

/** Field edits applied to the editor store: each commit is one undo step, previews are none. */
export const storeFieldActions: NodeFieldActions = {
  setInputValue: (ref, value) => {
    getStore().setInputValue(ref, value)
  },
  previewInputValue: (ref, value) => {
    getStore().previewInputValue(ref, value)
  },
  endInputPreview: () => {
    getStore().clearInputPreview()
  },
  setParam: (ref, value) => {
    getStore().setParam(ref, value)
  },
  changeGraph: (change) => {
    getStore().applyGraphChange(change)
  },
}
