import { memo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'

import { useGraphCanvasActions } from './graph-canvas-actions'
import { NodeContextMenu } from './node-context-menu'
import { SELECTED_FRAME_CLASS } from './selected-frame'
import { frameOf } from './node-frame'
import { nodeDescriptionId } from './to-flow'
import type { FlowNode, FlowNodeData } from './to-flow'

const TITLE_PARAM = 'title'

interface CommentTitleFieldProps {
  data: FlowNodeData
}

/**
 * The frame's title, edited in place. Enter or leaving the field commits it (one undo step);
 * Escape reverts what was typed.
 */
function CommentTitleField({ data }: CommentTitleFieldProps) {
  const { setParam } = useGraphCanvasActions()
  const [draft, setDraft] = useState<string | null>(null)

  const commitDraft = (): void => {
    if (draft === null) return
    setDraft(null)
    const title = draft.trim()
    if (title === '' || title === data.title) return
    setParam({ nodeId: data.node.id, paramId: TITLE_PARAM }, title)
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
      type="text"
      aria-label="Comment title"
      autoComplete="off"
      spellCheck={false}
      value={draft ?? data.title}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={commitDraft}
      onKeyDown={onKeyDown}
      // Quiet inline title: no box of its own, only the quiet focus border while editing. Its 8px
      // text inset (1px border + 7px padding) matches the inset from the header's top.
      className="nodrag h-full min-w-0 flex-1 rounded-none border-transparent bg-transparent px-[7px] py-0 font-heading text-base font-semibold tracking-wide uppercase shadow-none md:text-xs dark:bg-transparent"
    />
  )
}

/**
 * A comment frame: a resizable, titled area behind the nodes. It doesn't own the nodes on it, so
 * selecting or dragging the frame never touches them. The resize handles show while it is
 * selected; with the keyboard, Alt + arrow keys resize it (see the canvas keyboard model).
 */
function CommentNodeViewComponent({ data, selected }: NodeProps<FlowNode>) {
  const frame = frameOf(data.node, data.definition)

  return (
    <>
      {frame !== null && (
        <NodeResizer
          isVisible={selected}
          minWidth={frame.minWidth}
          minHeight={frame.minHeight}
          lineClassName="comment-resize-line"
          handleClassName="comment-resize-handle"
        />
      )}
      <NodeContextMenu data={data}>
        <div
          className={cn(
            'flex size-full flex-col border border-dashed border-muted-foreground/60 bg-muted/25',
            selected && ['border-solid', SELECTED_FRAME_CLASS],
          )}
        >
          <p id={nodeDescriptionId(data.node.id)} className="sr-only">
            {data.definition.description}
          </p>
          <header className="flex h-8 shrink-0 items-stretch border-b border-inherit">
            <CommentTitleField data={data} />
          </header>
        </div>
      </NodeContextMenu>
    </>
  )
}

export const CommentNodeView = memo(CommentNodeViewComponent)
