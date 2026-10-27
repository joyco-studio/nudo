import { useId } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { PANEL_HEADER_ATTRIBUTE, PANEL_SHORTCUT_KEYS } from './panel-shortcut-action'
import type { PanelId } from './panel-state'

/** Which edge the panel sits on, which picks the collapse icon. */
export type PanelEdge = 'left' | 'right' | 'bottom'

const TOGGLE_ICONS: Readonly<Record<PanelEdge, { open: LucideIcon; closed: LucideIcon }>> = {
  left: { open: PanelLeftClose, closed: PanelLeftOpen },
  right: { open: PanelRightClose, closed: PanelRightOpen },
  bottom: { open: PanelBottomClose, closed: PanelBottomOpen },
}

const TOOLTIP_SIDES: Readonly<Record<PanelEdge, 'left' | 'right' | 'top'>> = {
  left: 'right',
  right: 'left',
  bottom: 'top',
}

const PANEL_HEADER_PROPS = { [PANEL_HEADER_ATTRIBUTE]: '' }

export interface PanelFrameProps {
  panel: PanelId
  /** Visible heading; the toggle is named "<title> panel". */
  title: string
  /** Name of the panel landmark when it differs from the title. */
  regionLabel?: string
  edge: PanelEdge
  /** Controls placed in the header, before the collapse toggle. */
  headerActions?: ReactNode
  className?: string
  bodyClassName?: string
  /** Hides the whole panel (for instance while the preview fills the workspace). */
  isHidden?: boolean
  children: ReactNode
}

/**
 * A collapsible editor panel. The header always shows; the toggle (or the panel's letter, see
 * `use-panel-shortcuts`) collapses the body. Open state lives in the store and is persisted.
 */
export function PanelFrame({
  panel,
  title,
  regionLabel = title,
  edge,
  headerActions,
  className,
  bodyClassName,
  isHidden = false,
  children,
}: PanelFrameProps) {
  const isOpen = useEditorStore((state) => state.panels.open[panel])
  const bodyId = useId()
  const Icon = isOpen ? TOGGLE_ICONS[edge].open : TOGGLE_ICONS[edge].closed
  const hint = `${isOpen ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`

  return (
    <section
      aria-label={regionLabel}
      hidden={isHidden}
      data-panel={panel}
      data-open={isOpen}
      className={cn('flex min-h-0 flex-col border bg-background/85 backdrop-blur-md', className)}
    >
      <div
        {...PANEL_HEADER_PROPS}
        className="flex h-8 shrink-0 items-center gap-2 bg-muted/50 pl-3"
      >
        <h2 className="flex-1 truncate font-heading text-sm font-semibold tracking-wide uppercase">
          {title}
        </h2>
        {headerActions}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${title} panel`}
              aria-expanded={isOpen}
              aria-controls={bodyId}
              aria-keyshortcuts={PANEL_SHORTCUT_KEYS[panel]}
              onClick={() => {
                useEditorStore.getState().togglePanel(panel)
              }}
            >
              <Icon aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={TOOLTIP_SIDES[edge]}>
            {hint} <Kbd>{PANEL_SHORTCUT_KEYS[panel]}</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      <div id={bodyId} hidden={!isOpen} className={cn('min-h-0 border-t', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
