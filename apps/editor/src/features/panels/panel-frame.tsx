import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
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
  /** What the panel holds, in a tooltip on the title and as the landmark's description. */
  description?: string
  edge: PanelEdge
  /** Controls placed in the header, before the collapse toggle. */
  headerActions?: ReactNode
  className?: string
  style?: CSSProperties | undefined
  bodyClassName?: string
  /** Hides the whole panel (for instance while the preview fills the workspace). */
  isHidden?: boolean
  children: ReactNode
}

interface PanelTitleProps {
  title: string
  description: string | undefined
  descriptionId: string
}

/** The heading; a description shows on hover and is the landmark's description for everyone. */
function PanelTitle({ title, description, descriptionId }: PanelTitleProps) {
  const heading = (
    <h2 className="truncate font-heading text-sm font-semibold tracking-wide uppercase">{title}</h2>
  )
  if (description === undefined) return <div className="min-w-0 flex-1">{heading}</div>
  return (
    <div className="min-w-0 flex-1">
      <span id={descriptionId} className="sr-only">
        {description}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block max-w-full align-middle">{heading}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" aria-hidden="true">
          {description}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/**
 * A collapsible editor panel (shadcn Collapsible). The header always shows; the toggle (or the
 * panel's letter, see `use-panel-shortcuts`) collapses the body. Open state lives in the store and is persisted.
 */
export function PanelFrame({
  panel,
  title,
  regionLabel = title,
  description,
  edge,
  headerActions,
  className,
  style,
  bodyClassName,
  isHidden = false,
  children,
}: PanelFrameProps) {
  const isOpen = useEditorStore((state) => state.panels.open[panel])
  const descriptionId = useId()
  const Icon = isOpen ? TOGGLE_ICONS[edge].open : TOGGLE_ICONS[edge].closed
  const hint = `${isOpen ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`

  return (
    <Collapsible
      asChild
      open={isOpen}
      onOpenChange={() => {
        useEditorStore.getState().togglePanel(panel)
      }}
    >
      <section
        aria-label={regionLabel}
        aria-describedby={description === undefined ? undefined : descriptionId}
        hidden={isHidden}
        data-panel={panel}
        data-open={isOpen}
        className={cn('flex min-h-0 flex-col border bg-background/85 backdrop-blur-md', className)}
        style={style}
      >
        <div
          {...PANEL_HEADER_PROPS}
          className="flex h-8 shrink-0 items-center gap-2 bg-muted/50 pl-3"
        >
          <PanelTitle title={title} description={description} descriptionId={descriptionId} />
          {headerActions}
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The collapsible trigger wires aria-expanded and aria-controls to the body. */}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${title} panel`}
                  aria-keyshortcuts={PANEL_SHORTCUT_KEYS[panel]}
                >
                  <Icon aria-hidden="true" />
                </Button>
              </CollapsibleTrigger>
            </TooltipTrigger>
            <TooltipContent side={TOOLTIP_SIDES[edge]}>
              {hint} <Kbd>{PANEL_SHORTCUT_KEYS[panel]}</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Kept mounted while collapsed, so the preview's renderer survives a collapse. */}
        <CollapsibleContent
          forceMount
          hidden={!isOpen}
          className={cn('min-h-0 border-t', bodyClassName)}
        >
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
