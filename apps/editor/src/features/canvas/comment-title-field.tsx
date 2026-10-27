import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { NodeId } from '@nudo-tsl/core'

import { Input } from '@/shared/ui/input'

import { COMMENT_TITLE_PARAM } from './comment-params'
import { useNodeFieldActions } from './node-field-actions'

export interface CommentTitleFieldProps {
  nodeId: NodeId
  /** The title the frame shows now. */
  title: string
  /** Ties the field to a visible `<Label htmlFor>`. */
  id?: string
  /** The accessible name when no visible label names the field. */
  ariaLabel?: string
  className: string
}

/**
 * A comment frame's title, edited in place on the frame or in the Inspector. Enter or leaving the
 * field commits it (one undo step); Escape reverts what was typed. A blank title is not kept.
 */
export function CommentTitleField({
  nodeId,
  title,
  id,
  ariaLabel,
  className,
}: CommentTitleFieldProps) {
  const { setParam } = useNodeFieldActions()
  const [draft, setDraft] = useState<string | null>(null)

  const commitDraft = (): void => {
    if (draft === null) return
    setDraft(null)
    const next = draft.trim()
    if (next === '' || next === title) return
    setParam({ nodeId, paramId: COMMENT_TITLE_PARAM }, next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraft()
    }
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Input
      id={id}
      type="text"
      aria-label={ariaLabel}
      autoComplete="off"
      spellCheck={false}
      value={draft ?? title}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={commitDraft}
      onKeyDown={onKeyDown}
      className={className}
    />
  )
}
