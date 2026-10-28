import { exampleGraph } from '@/examples'
import type { Example } from '@/examples'
import type { Locale } from '@/i18n/locale'
import { useEditorStore } from '@/store/editor-store'
import type { Notice } from '@/store/store-types'

const EXAMPLE_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.exampleFailed' }

/**
 * Replaces the graph with the example (one undo step), its comment frames in the UI language, and
 * shows it on the mesh it was made for. A document that doesn't parse leaves the graph alone and
 * says so. Returns whether the example opened.
 */
export function openExample(example: Example, locale: Locale): boolean {
  const store = useEditorStore.getState()
  const graph = exampleGraph(example, locale)
  if (!graph.ok) {
    store.showNotice(EXAMPLE_FAILED_NOTICE)
    return false
  }
  store.replaceGraph(graph.value)
  store.setPreviewShape(example.previewShape)
  return true
}
