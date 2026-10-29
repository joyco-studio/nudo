import { createContext, use } from 'react'

import type { ExampleId } from '@/examples'

/**
 * Opens the templates browser with `selected` chosen (null: the template chosen last, else the
 * first). `opener` gets focus back when the browser closes.
 */
export type OpenTemplatesBrowser = (opener: HTMLElement | null, selected: ExampleId | null) => void

export const ExamplesContext = createContext<OpenTemplatesBrowser | null>(null)

export function useOpenTemplatesBrowser(): OpenTemplatesBrowser {
  const openTemplatesBrowser = use(ExamplesContext)
  if (openTemplatesBrowser === null) {
    throw new Error('useOpenTemplatesBrowser must be used inside ExamplesProvider')
  }
  return openTemplatesBrowser
}
