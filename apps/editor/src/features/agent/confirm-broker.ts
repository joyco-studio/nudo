import type { ConfirmKind } from './tool-context'

/** What the person may be asked to confirm: an agent replacing the graph, or Undo all. */
export type AgentConfirmKind = ConfirmKind | 'undo_all'

export interface ConfirmBroker {
  /** Asks the person; resolves their answer. A question while another is open is declined. */
  readonly request: (kind: AgentConfirmKind) => Promise<boolean>
  /** The person's answer to the open question; nothing when none is open. */
  readonly answer: (isConfirmed: boolean) => void
  readonly pending: () => AgentConfirmKind | null
  readonly subscribe: (listener: () => void) => () => void
}

interface OpenQuestion {
  readonly kind: AgentConfirmKind
  readonly resolve: (isConfirmed: boolean) => void
}

/**
 * Connects the questions the agent tools and the activity panel ask (plain promises) to the one
 * confirm dialog React renders (`useSyncExternalStore` on `pending`).
 */
export function createConfirmBroker(): ConfirmBroker {
  let open: OpenQuestion | null = null
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    request(kind) {
      if (open !== null) return Promise.resolve(false)
      return new Promise<boolean>((resolve) => {
        open = { kind, resolve }
        notify()
      })
    },
    answer(isConfirmed) {
      if (open === null) return
      const { resolve } = open
      open = null
      notify()
      resolve(isConfirmed)
    },
    pending: () => open?.kind ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
