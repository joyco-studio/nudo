import { exampleGraph } from '@/examples'
import type { Example } from '@/examples'
import { bindTemplateTextures } from '@/examples/bind-template-textures'
import type { Locale } from '@/i18n/locale'
import { useEditorStore } from '@/store/editor-store'
import type { Notice } from '@/store/store-types'

import { loadTemplateTextures } from './load-template-textures'
import type { TemplateTextureLoad } from './load-template-textures'

const EXAMPLE_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.exampleFailed' }
const TEXTURES_FAILED_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.templateTexturesFailed',
}
const TEXTURES_UNSAVED_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.templateTexturesUnsaved',
}

const alwaysWanted = (): boolean => true

/** What the person should hear about the textures; a missing image outweighs an unsaved one. */
function texturesNotice(textures: TemplateTextureLoad): Notice | null {
  if (textures.failed.length > 0) return TEXTURES_FAILED_NOTICE
  if (textures.unsaved.length > 0) return TEXTURES_UNSAVED_NOTICE
  return null
}

/**
 * Replaces the graph with the example (one undo step), its comment frames in the UI language, and
 * shows it on the mesh it was made for. The template's own textures load first and are stored like
 * uploads, so the graph arrives with its texture slots already pointing at them. A texture that
 * doesn't load leaves its slots missing, one that loads but can't be stored draws for this session
 * only, and a notice says which; a document that doesn't parse leaves the graph alone and says so.
 * Once the textures are in, the example is dropped (the graph left alone) when the graph was
 * swapped meanwhile (replaced, reset, undone or redone) or `isStillWanted` says no (another
 * template was asked for). Resolves whether the example opened; never rejects.
 */
export async function openExample(
  example: Example,
  locale: Locale,
  isStillWanted: () => boolean = alwaysWanted,
): Promise<boolean> {
  const graph = exampleGraph(example, locale)
  if (!graph.ok) {
    useEditorStore.getState().showNotice(EXAMPLE_FAILED_NOTICE)
    return false
  }
  const generation = useEditorStore.getState().graphGeneration
  const textures = await loadTemplateTextures(example.textures, 'open')
  const store = useEditorStore.getState()
  if (store.graphGeneration !== generation || !isStillWanted()) return false
  store.replaceGraph(bindTemplateTextures(graph.value, textures.bindings))
  store.setPreviewShape(example.previewShape)
  const notice = texturesNotice(textures)
  if (notice !== null) store.showNotice(notice)
  return true
}
