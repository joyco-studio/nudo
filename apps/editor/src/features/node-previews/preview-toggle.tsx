import type { AnyNodeDefinition, GraphNode } from '@nudo-tsl/core'
import { Eye, EyeOff } from 'lucide-react'

import { useNodeFieldActions } from '@/features/canvas/node-field-actions'
import { IconSwap } from '@/shared/components/icon-swap'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { SHOW_PREVIEW_PARAM, hasNodePreview, isPreviewShown } from './preview-graph'

/** The toggle's accessible name; `aria-pressed` carries whether the preview is showing. */
export const PREVIEW_TOGGLE_LABEL = 'Preview'

/** The action the toggle performs, worded the same in its tooltip and in the node's menu. */
export function previewToggleAction(isShown: boolean): string {
  return isShown ? 'Hide preview' : 'Show preview'
}

interface PreviewToggleProps {
  node: GraphNode
  definition: AnyNodeDefinition
  className?: string
}

/**
 * The node header's preview switch: the universal `showPreview` param, so it is saved with the
 * graph, undoes in one step and never recompiles. Nodes without a preview have no toggle.
 */
export function PreviewToggle({ node, definition, className }: PreviewToggleProps) {
  const { setParam } = useNodeFieldActions()
  if (!hasNodePreview(node, definition)) return null
  const isShown = isPreviewShown(node)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          static
          variant="ghost"
          size="icon-xs"
          aria-label={PREVIEW_TOGGLE_LABEL}
          aria-pressed={isShown}
          onClick={() => {
            setParam({ nodeId: node.id, paramId: SHOW_PREVIEW_PARAM }, !isShown)
          }}
          className={cn('nodrag text-muted-foreground hover:text-foreground', className)}
        >
          <IconSwap swapKey={isShown ? 'shown' : 'hidden'}>
            {isShown ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          </IconSwap>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{previewToggleAction(isShown)}</TooltipContent>
    </Tooltip>
  )
}
