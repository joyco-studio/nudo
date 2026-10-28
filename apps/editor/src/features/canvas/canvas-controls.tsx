import type { LucideIcon } from 'lucide-react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { Panel, useReactFlow } from '@xyflow/react'

import { commandLabelKey } from '@/features/command-palette/command-text'
import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { ButtonGroup } from '@/shared/ui/button-group'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { usePanelAwareView } from './use-panel-aware-view'

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
  const { zoomIn, zoomOut } = useReactFlow()
  const view = usePanelAwareView()
  const t = useT()

  return (
    <Panel position="bottom-left">
      <ButtonGroup orientation="vertical" aria-label={t('canvas.controls')}>
        <ControlButton
          label={t('canvas.zoomIn')}
          icon={Plus}
          onClick={() => {
            void zoomIn()
          }}
        />
        <ControlButton
          label={t('canvas.zoomOut')}
          icon={Minus}
          onClick={() => {
            void zoomOut()
          }}
        />
        <ControlButton
          label={t(commandLabelKey('fit-view'))}
          icon={Maximize}
          shortcut="F"
          // Same fit as the F key and the canvas menu, clear of the panels as they are now.
          onClick={view.fitAll}
        />
      </ButtonGroup>
    </Panel>
  )
}
