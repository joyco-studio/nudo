import type { ConfirmKind } from './tool-context'

/** What the person may be asked to confirm: an agent replacing the graph, or Undo all. */
export type AgentConfirmKind = ConfirmKind | 'undo_all'

export interface ConfirmBroker {
  /**
   * Asks the person; resolves their answer. A question while another is open is declined, and so
   * is one whose `signal` aborts before the person answers (the question closes).
   */
  readonly request: (kind: AgentConfirmKind, signal?: AbortSignal) => Promise<boolean>
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
  /** Answers `question`, only while it is still the open one. */
  const settle = (question: OpenQuestion, isConfirmed: boolean): void => {
    if (open !== question) return
    open = null
    notify()
    question.resolve(isConfirmed)
  }

  return {
    request(kind, signal) {
      if (open !== null || signal?.aborted === true) return Promise.resolve(false)
      return new Promise<boolean>((resolve) => {
        const question: OpenQuestion = { kind, resolve }
        open = question
        signal?.addEventListener(
          'abort',
          () => {
            settle(question, false)
          },
          { once: true },
        )
        notify()
      })
    },
    answer(isConfirmed) {
      if (open !== null) settle(open, isConfirmed)
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
