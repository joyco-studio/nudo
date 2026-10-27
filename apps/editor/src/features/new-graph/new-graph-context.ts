import { createContext, use } from 'react'

/**
 * Starts a new graph, asking first when that would clear nodes or properties. `opener` gets
 * focus back when the confirmation closes.
 */
export type RequestNewGraph = (opener: HTMLElement | null) => void

export const NewGraphContext = createContext<RequestNewGraph | null>(null)

export function useRequestNewGraph(): RequestNewGraph {
  const requestNewGraph = use(NewGraphContext)
  if (requestNewGraph === null) {
    throw new Error('useRequestNewGraph must be used inside NewGraphProvider')
  }
  return requestNewGraph
}
