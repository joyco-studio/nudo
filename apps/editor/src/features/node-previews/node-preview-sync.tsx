import { useEffect } from 'react'

import { textureCache } from '@/features/assets/texture-cache'
import { useEditorStore } from '@/store/editor-store'
import type { EditorState } from '@/store/store-types'

import type { PreviewEngine } from './preview-engine'
import { getSharedPreviewEngine } from './shared-preview-engine'

type PreviewChannel = Pick<EditorState, 'inputPreview' | 'propertyPreview'>

/** Shows a value being scrubbed or picked on the node previews, when it is new. */
function showValuePreviews(
  engine: PreviewEngine,
  state: PreviewChannel,
  previous: PreviewChannel,
): void {
  const { inputPreview, propertyPreview } = state
  if (inputPreview !== null && inputPreview !== previous.inputPreview) {
    engine.previewValue(inputPreview.ref, inputPreview.value)
  }
  if (propertyPreview !== null && propertyPreview !== previous.propertyPreview) {
    engine.previewPropertyValue(propertyPreview.id, propertyPreview.value)
  }
}

/**
 * Keeps the node previews in step with the editor: graph edits, the values a scrub shows before
 * it commits, and texture assets that finish loading.
 */
export function NodePreviewSync() {
  useEffect(() => {
    const engine = getSharedPreviewEngine()
    engine.update(useEditorStore.getState().graph)
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.graph !== previous.graph) engine.update(state.graph)
      showValuePreviews(engine, state, previous)
    })
    const unsubscribeTextures = textureCache.subscribe((assetId, state) => {
      if (state === 'ready') engine.textureLoaded(assetId)
    })
    return () => {
      unsubscribe()
      unsubscribeTextures()
    }
  }, [])

  return null
}
