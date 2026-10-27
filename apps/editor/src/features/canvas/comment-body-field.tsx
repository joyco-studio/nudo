import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { NodeId } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'
import { Textarea } from '@/shared/ui/textarea'

import { NODE_ENTRY_ATTRIBUTE } from './canvas-keyboard-model'
import { COMMENT_BODY_PARAM } from './comment-params'
import { useNodeFieldActions } from './node-field-actions'
import { useScrollOverflow } from './use-scroll-overflow'

/** Enter on the frame steps into the note rather than the title. */
const NODE_ENTRY_PROPS = { [NODE_ENTRY_ATTRIBUTE]: '' }

/** The frame's own quiet note: no box, filling the body and scrolling inside it. */
const ON_FRAME_CLASS =
  'nodrag min-h-0 flex-1 cursor-text resize-none overflow-y-auto rounded-none border-transparent bg-transparent p-[7px] text-base shadow-none field-sizing-fixed focus-visible:border-transparent md:text-xs dark:bg-transparent'

interface CommentBodyFieldProps {
  nodeId: NodeId
  /** The note the frame holds now. */
  body: string
  /** Ties the field to a visible `<Label htmlFor>` (the Inspector); the frame names it itself. */
  id?: string
  /** Replaces the on-frame look (the Inspector draws a boxed field). */
  className?: string
}

/**
 * The note in a comment frame's body. An edit session is one undo step: leaving the field commits
 * what was typed, and Escape reverts it (the canvas keyboard model then returns focus to the
 * frame). Enter is a newline. Dragging inside selects text instead of moving the frame, and the
 * wheel scrolls a long note instead of zooming the canvas.
 */
export function CommentBodyField({ nodeId, body, id, className }: CommentBodyFieldProps) {
  const { setParam } = useNodeFieldActions()
  const [draft, setDraft] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const value = draft ?? body
  const overflows = useScrollOverflow(fieldRef, value)

  const commitDraft = (): void => {
    if (draft === null) return
    setDraft(null)
    if (draft === body) return
    setParam({ nodeId, paramId: COMMENT_BODY_PARAM }, draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Textarea
      ref={fieldRef}
      id={id}
      aria-label={id === undefined ? 'Comment text' : undefined}
      placeholder="Write a note…"
      value={value}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={commitDraft}
      onKeyDown={onKeyDown}
      {...NODE_ENTRY_PROPS}
      // On the frame its 8px text inset (1px border + 7px padding) on every side matches the
      // title's, and only the quiet focus border shows while editing.
      className={cn(className ?? ON_FRAME_CLASS, overflows && 'nowheel')}
    />
  )
}
