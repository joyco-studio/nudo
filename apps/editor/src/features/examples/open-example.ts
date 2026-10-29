import { exampleGraph } from '@/examples'
import type { Example } from '@/examples'
import { bindTemplateTextures } from '@/examples/bind-template-textures'
import type { Locale } from '@/i18n/locale'
import { useEditorStore } from '@/store/editor-store'
import type { Notice } from '@/store/store-types'

import { loadTemplateTextures } from './load-template-textures'

const EXAMPLE_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.exampleFailed' }
const TEXTURES_FAILED_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.templateTexturesFailed',
}

const alwaysWanted = (): boolean => true

/**
 * Replaces the graph with the example (one undo step), its comment frames in the UI language, and
 * shows it on the mesh it was made for. The template's own textures load first and are stored like
 * uploads, so the graph arrives with its texture slots already pointing at them. A texture that
 * doesn't load leaves its slots missing and a notice says so; a document that doesn't parse leaves
 * the graph alone and says so. `isStillWanted` is asked once the textures are in: false (another
 * template was asked for meanwhile) leaves the graph alone. Resolves whether the example opened;
 * never rejects.
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
  const textures = await loadTemplateTextures(example.textures, 'open')
  if (!isStillWanted()) return false
  const store = useEditorStore.getState()
  store.replaceGraph(bindTemplateTextures(graph.value, textures.bindings))
  store.setPreviewShape(example.previewShape)
  if (textures.failed.length > 0) store.showNotice(TEXTURES_FAILED_NOTICE)
  return true
}
