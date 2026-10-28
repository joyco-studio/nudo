import { useId } from 'react'
import type { AnyNodeDefinition, Graph, GraphNode, NodeId, ResolvedTypes } from '@nudo-tsl/core'

import { CommentBodyField } from '@/features/canvas/comment-body-field'
import { commentBody } from '@/features/canvas/comment-params'
import { CommentTitleField } from '@/features/canvas/comment-title-field'
import { frameOf, sizedFrame } from '@/features/canvas/node-frame'
import type { ResizableFrame } from '@/features/canvas/node-frame'
import { groupInputs } from '@/features/canvas/node-port-layout'
import { NumberField } from '@/features/canvas/number-field'
import { ParamField, bodyParams } from '@/features/canvas/param-field'
import { nodeTitle } from '@/features/canvas/to-flow'
import { Label } from '@/shared/ui/label'
import type { NodeFrame } from '@/store/store-types'

import { INSPECTOR_ROW_CLASS, InspectorInputRows } from './inspector-input-row'
import { InspectorHeader, InspectorSection } from './inspector-section'
import { PreviewSettings } from './preview-settings'

const SETTINGS_TITLE = 'Settings'
const INPUTS_TITLE = 'Inputs'
const FRAME_TITLE = 'Frame'

/** Commits a comment frame's new size as one history entry. */
export type ResizeFrame = (nodeId: NodeId, frame: NodeFrame) => void

/** Frame sizes are whole pixels: arrows step by 1 (Shift: 10) instead of 0.1. */
const PIXEL_STEP_SCALE = 10

/** A size field has no live preview channel: the scrubbed value shows in the field until release. */
const ignoreScrubPreview = (): void => {}

interface FrameFieldsProps {
  node: GraphNode
  title: string
  frame: ResizableFrame
  onResize: ResizeFrame
}

/** A comment frame's title, note and size: the same edits as on the frame and its handles. */
function FrameFields({ node, title, frame, onResize }: FrameFieldsProps) {
  const titleId = useId()
  const bodyId = useId()
  const resizeTo = (size: { width?: number; height?: number }): void => {
    onResize(node.id, sizedFrame(frame, size))
  }

  return (
    <InspectorSection title={FRAME_TITLE}>
      <ul>
        <li className={INSPECTOR_ROW_CLASS}>
          <Label htmlFor={titleId} className="min-w-0 flex-1 text-xs font-normal">
            Title
          </Label>
          <CommentTitleField
            id={titleId}
            nodeId={node.id}
            title={title}
            className="h-7 w-36 shrink-0 rounded-none border-border bg-background px-1.5 py-0 text-base hover:border-muted-foreground md:text-xs dark:bg-background"
          />
        </li>
        <li className="flex flex-col gap-1.5 px-3 py-2">
          <Label htmlFor={bodyId} className="text-xs font-normal">
            Note
          </Label>
          <CommentBodyField
            id={bodyId}
            nodeId={node.id}
            body={commentBody(node)}
            className="min-h-20 resize-y rounded-none border-border bg-background px-1.5 py-1 text-base hover:border-muted-foreground md:text-xs dark:bg-background"
          />
        </li>
        <li className={INSPECTOR_ROW_CLASS}>
          <NumberField
            label="Width"
            value={frame.width}
            isDefault={node.params.width === undefined}
            layout="row"
            stepScale={PIXEL_STEP_SCALE}
            isInteger
            onCommit={(width) => {
              resizeTo({ width })
            }}
            onScrubPreview={ignoreScrubPreview}
            onScrubPreviewEnd={ignoreScrubPreview}
          />
        </li>
        <li className={INSPECTOR_ROW_CLASS}>
          <NumberField
            label="Height"
            value={frame.height}
            isDefault={node.params.height === undefined}
            layout="row"
            stepScale={PIXEL_STEP_SCALE}
            isInteger
            onCommit={(height) => {
              resizeTo({ height })
            }}
            onScrubPreview={ignoreScrubPreview}
            onScrubPreviewEnd={ignoreScrubPreview}
          />
        </li>
      </ul>
    </InspectorSection>
  )
}

interface InputSectionsProps {
  graph: Graph
  node: GraphNode
  definition: AnyNodeDefinition
  types: ResolvedTypes
}

/** Every input of the node, collapsed or not, grouped like the node groups them. */
function InputSections({ graph, node, definition, types }: InputSectionsProps) {
  const groups = groupInputs(node, definition.inputs).filter((group) => group.rows.length > 0)

  return groups.map((group) => (
    <InspectorSection key={group.title ?? INPUTS_TITLE} title={group.title ?? INPUTS_TITLE}>
      <ul>
        <InspectorInputRows graph={graph} node={node} rows={group.rows} types={types} />
      </ul>
    </InspectorSection>
  ))
}

export interface NodeInspectorProps {
  graph: Graph
  node: GraphNode
  definition: AnyNodeDefinition
  types: ResolvedTypes
  onResizeFrame: ResizeFrame
}

/**
 * The selected node: its name, type and what it does, then its settings, its frame (for a
 * comment), every input, each with the editor the node shows inline, and its preview.
 */
export function NodeInspector({
  graph,
  node,
  definition,
  types,
  onResizeFrame,
}: NodeInspectorProps) {
  const title = nodeTitle(node, definition, graph.properties)
  const params = bodyParams(definition.params)
  const frame = frameOf(node, definition)

  return (
    <div>
      <InspectorHeader title={title}>
        {definition.formula !== undefined && (
          <p data-node-formula className="font-mono text-xs break-words">
            <span className="sr-only">Formula: </span>
            {definition.formula}
          </p>
        )}
        <p className="font-mono text-micro text-muted-foreground">
          <span className="sr-only">Type: </span>
          {node.type}
        </p>
        <p className="text-xs text-pretty text-muted-foreground">{definition.description}</p>
      </InspectorHeader>
      {params.length > 0 && (
        <InspectorSection title={SETTINGS_TITLE}>
          <ul>
            {params.map((param) => (
              <ParamField key={param.id} node={node} param={param} />
            ))}
          </ul>
        </InspectorSection>
      )}
      {frame !== null && (
        <FrameFields node={node} title={title} frame={frame} onResize={onResizeFrame} />
      )}
      <InputSections graph={graph} node={node} definition={definition} types={types} />
      <PreviewSettings node={node} definition={definition} />
    </div>
  )
}
