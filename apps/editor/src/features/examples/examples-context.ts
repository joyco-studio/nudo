import { createContext, use } from 'react'

import type { ExampleId } from '@/examples'

/**
 * Opens an example in place of the graph, asking first when that would replace work. `opener`
 * gets focus back afterwards.
 */
export type RequestExample = (id: ExampleId, opener: HTMLElement | null) => void

export const ExamplesContext = createContext<RequestExample | null>(null)

export function useRequestExample(): RequestExample {
  const requestExample = use(ExamplesContext)
  if (requestExample === null) {
    throw new Error('useRequestExample must be used inside ExamplesProvider')
  }
  return requestExample
}
