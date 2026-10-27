import type { LucideIcon } from 'lucide-react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { Panel, useReactFlow } from '@xyflow/react'

import { Button } from '@/shared/ui/button'
import { ButtonGroup } from '@/shared/ui/button-group'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { fitViewOptionsFor } from './fit-view-options'

interface ControlButtonProps {
  label: string
  icon: LucideIcon
  shortcut?: string
  onClick: () => void
}

function ControlButton({ label, icon: Icon, shortcut, onClick }: ControlButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          static
          variant="outline"
          size="icon-sm"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          onClick={onClick}
          className="border-border bg-background dark:border-border dark:bg-background"
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {shortcut !== undefined && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

/** Zoom and fit for the node canvas, named apart from the preview's own zoom buttons. */
export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <Panel position="bottom-left">
      <ButtonGroup orientation="vertical" aria-label="Canvas view">
        <ControlButton
          label="Zoom canvas in"
          icon={Plus}
          onClick={() => {
            void zoomIn()
          }}
        />
        <ControlButton
          label="Zoom canvas out"
          icon={Minus}
          onClick={() => {
            void zoomOut()
          }}
        />
        <ControlButton
          label="Fit all nodes in view"
          icon={Maximize}
          shortcut="F"
          onClick={() => {
            // Same fit as the F key and the canvas menu, for the window as it is now.
            void fitView(fitViewOptionsFor(window.innerWidth))
          }}
        />
      </ButtonGroup>
    </Panel>
  )
}
