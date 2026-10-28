import { useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

import type { MessageKey } from '@/i18n/translate'

/** How an edit ended: Enter or leaving the field kept it; Escape dropped it. */
export type DraftOutcome = 'committed' | 'cancelled'

export interface TextDraftOptions {
  /** What the field shows while nothing is typed. */
  value: string
  /**
   * Applies the trimmed text; returns why it was rejected (a message key, so the reason follows a
   * language switch), or null once it is applied.
   */
  commit: (text: string) => MessageKey | null
  /**
   * On leaving the field with rejected text: `keep` leaves it and its message in the field to fix,
   * `revert` puts the value back.
   */
  onInvalidBlur: 'keep' | 'revert'
  /** Called once an edit ends, and whether it ended from a key or by leaving the field. */
  onDone?: (outcome: DraftOutcome, via: 'key' | 'blur') => void
}

export interface TextDraft {
  /** Why the last commit was rejected; shown under the field and linked to it. */
  error: MessageKey | null
  inputProps: {
    value: string
    'aria-invalid': boolean
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
    onBlur: () => void
  }
}

/**
 * An inline text edit: typing keeps a draft, Enter or leaving the field commits it, and Escape
 * reverts it. A rejected commit keeps the old value in the graph and explains why.
 */
export function useTextDraft({
  value,
  commit,
  onInvalidBlur,
  onDone,
}: TextDraftOptions): TextDraft {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)

  const finish = (via: 'key' | 'blur'): void => {
    if (draft === null) {
      setError(null)
      onDone?.('committed', via)
      return
    }
    const problem = commit(draft.trim())
    if (problem === null) {
      setDraft(null)
      setError(null)
      onDone?.('committed', via)
      return
    }
    setError(problem)
    if (via === 'blur' && onInvalidBlur === 'revert') {
      setDraft(null)
      setError(null)
      onDone?.('cancelled', via)
    }
  }

  const cancel = (): void => {
    setDraft(null)
    setError(null)
    onDone?.('cancelled', 'key')
  }

  return {
    error,
    inputProps: {
      value: draft ?? value,
      'aria-invalid': error !== null,
      onChange: (event) => {
        setDraft(event.target.value)
        setError(null)
      },
      onKeyDown: (event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') {
          event.preventDefault()
          finish('key')
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      },
      onBlur: () => {
        finish('blur')
      },
    },
  }
}
