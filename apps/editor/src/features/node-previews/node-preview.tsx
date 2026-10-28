import type { AnyNodeDefinition, GraphNode, NodeId } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'

import type { NodePreviewStatus } from './preview-engine'
import { isPreviewShown, previewPortRef } from './preview-graph'
import type { PreviewShape } from './preview-graph'
import { NODE_PREVIEW_SIZE, nodePreviewPixelRatio } from './shared-preview-engine'
import { useNodePreview } from './use-node-preview'

const NO_PREVIEW_TEXT = 'No preview'

/** The square a 2D preview fills, or the circle a 3D one is drawn in, like Unity's previews. */
const SHAPE_CLASS: Readonly<Record<PreviewShape, string>> = {
  '2d': 'rounded-none',
  '3d': 'rounded-full',
}

/** Diagonal hatching from the border token: reads as "nothing here" in both themes. */
const HATCHED_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]'

const hasNoPicture = (status: NodePreviewStatus | undefined): boolean =>
  status === 'error' || status === 'unavailable'

interface PreviewCanvasProps {
  nodeId: NodeId
  portId: string
  title: string
}

function PreviewCanvas({ nodeId, portId, title }: PreviewCanvasProps) {
  const { canvasRef, snapshot } = useNodePreview(nodeId, portId)
  const shape = snapshot?.shape ?? '2d'
  const isMissing = hasNoPicture(snapshot?.status)
  const pixels = Math.round(NODE_PREVIEW_SIZE * nodePreviewPixelRatio())

  return (
    <div
      data-preview-shape={shape}
      data-preview-status={snapshot?.status ?? 'pending'}
      className={cn(
        'relative grid size-24 shrink-0 place-items-center overflow-hidden bg-muted',
        SHAPE_CLASS[shape],
        isMissing && cn('border bg-card', HATCHED_CLASS),
      )}
    >
      {/* Stays mounted while it shows nothing, so the preview comes back once it compiles. */}
      <canvas
        ref={canvasRef}
        width={pixels}
        height={pixels}
        role="img"
        aria-label={`${title} preview`}
        aria-hidden={isMissing || undefined}
        className={cn('col-start-1 row-start-1 size-24', isMissing && 'invisible')}
      />
      {isMissing && (
        <p className="col-start-1 row-start-1 bg-card px-1 font-mono text-micro text-muted-foreground uppercase">
          {NO_PREVIEW_TEXT}
        </p>
      )}
    </div>
  )
}

interface NodePreviewProps {
  node: GraphNode
  definition: AnyNodeDefinition
  title: string
}

/**
 * A node's live preview below its body: its first output drawn by the shared preview renderer.
 * Nothing for nodes without a preview (the master, pills, reroutes) or with it switched off.
 */
export function NodePreview({ node, definition, title }: NodePreviewProps) {
  const ref = previewPortRef(node, definition)
  if (ref === null || !isPreviewShown(node)) return null

  return (
    <div className="flex justify-center border-t p-3">
      <PreviewCanvas nodeId={ref.nodeId} portId={ref.portId} title={title} />
    </div>
  )
}
