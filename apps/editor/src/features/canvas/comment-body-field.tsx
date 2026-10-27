import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { GraphNode } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'
import { Textarea } from '@/shared/ui/textarea'

import { NODE_ENTRY_ATTRIBUTE } from './canvas-keyboard-model'
import { useGraphCanvasActions } from './graph-canvas-actions'
import type { FlowNodeData } from './to-flow'
import { useScrollOverflow } from './use-scroll-overflow'

const BODY_PARAM = 'body'
/** Enter on the frame steps into the note rather than the title. */
const NODE_ENTRY_PROPS = { [NODE_ENTRY_ATTRIBUTE]: '' }

function storedBody(node: GraphNode): string {
  const value = node.params[BODY_PARAM]
  return typeof value === 'string' ? value : ''
}

interface CommentBodyFieldProps {
  data: FlowNodeData
}

/**
 * The note in a comment frame's body. An edit session is one undo step: leaving the field commits
 * what was typed, and Escape reverts it (the canvas keyboard model then returns focus to the
 * frame). Enter is a newline. Dragging inside selects text instead of moving the frame, and the
 * wheel scrolls a long note instead of zooming the canvas.
 */
export function CommentBodyField({ data }: CommentBodyFieldProps) {
  const { setParam } = useGraphCanvasActions()
  const [draft, setDraft] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const body = storedBody(data.node)
  const value = draft ?? body
  const overflows = useScrollOverflow(fieldRef, value)

  const commitDraft = (): void => {
    if (draft === null) return
    setDraft(null)
    if (draft === body) return
    setParam({ nodeId: data.node.id, paramId: BODY_PARAM }, draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Textarea
      ref={fieldRef}
      aria-label="Comment text"
      placeholder="Write a note…"
      value={value}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={commitDraft}
      onKeyDown={onKeyDown}
      {...NODE_ENTRY_PROPS}
      // Fills the body and scrolls inside it. Its 8px text inset (1px border + 7px padding) on
      // every side matches the title's, and only the quiet focus border shows while editing.
      className={cn(
        'nodrag min-h-0 flex-1 cursor-text resize-none overflow-y-auto rounded-none border-transparent bg-transparent p-[7px] text-base shadow-none field-sizing-fixed focus-visible:border-transparent md:text-xs dark:bg-transparent',
        overflows && 'nowheel',
      )}
    />
  )
}
