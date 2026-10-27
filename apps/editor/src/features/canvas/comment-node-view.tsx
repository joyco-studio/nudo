import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { cn } from '@/shared/lib/utils'

import { CommentTitleField } from './comment-title-field'
import { NodeContextMenu } from './node-context-menu'
import { SELECTED_FRAME_CLASS } from './selected-frame'
import { frameOf } from './node-frame'
import { nodeDescriptionId } from './to-flow'
import type { FlowNode } from './to-flow'

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
            {/* Quiet inline title: no box of its own, only the quiet focus border while editing.
                Its 8px text inset (1px border + 7px padding) matches the inset from the top. */}
            <CommentTitleField
              nodeId={data.node.id}
              title={data.title}
              ariaLabel="Comment title"
              className="nodrag h-full min-w-0 flex-1 rounded-none border-transparent bg-transparent px-[7px] py-0 font-heading text-base font-semibold tracking-wide uppercase shadow-none md:text-xs dark:bg-transparent"
            />
          </header>
        </div>
      </NodeContextMenu>
    </>
  )
}

export const CommentNodeView = memo(CommentNodeViewComponent)
