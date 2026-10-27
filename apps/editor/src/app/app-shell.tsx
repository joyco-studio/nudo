import { useId, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'

import { PanelFrame } from '@/features/panels/panel-frame'
import { effectivePreviewLayout } from '@/features/panels/panel-state'
import type { PreviewLayout } from '@/features/panels/panel-state'
import { PreviewLayoutPicker } from '@/features/panels/preview-layout-picker'
import { SplitDivider } from '@/features/panels/split-divider'
import { useFullPreviewFocus } from '@/features/panels/use-full-preview-focus'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Cluster, Filler } from '@/shared/ui/cluster'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { useTheme } from './theme-provider'

/** Width of the split divider's grab area, in pixels. */
const DIVIDER_PX = 12
/** Below this width the floating panels stack in one column instead of flanking the canvas. */
const WIDE_QUERY = '(min-width: 768px)'

export interface AppShellProps {
  canvas: ReactNode
  blackboard: ReactNode
  inspector: ReactNode
  previewPanel: ReactNode
  codePanel: ReactNode
  headerActions: ReactNode
}

/** Canvas and preview share the width in split layout; otherwise the canvas takes all of it. */
function workspaceColumns(layout: PreviewLayout, splitPercent: number): CSSProperties {
  // One row, never taller than the viewport, so a grown preview canvas can shrink back.
  const gridTemplateRows = 'minmax(0, 1fr)'
  if (layout !== 'split') return { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows }
  return {
    gridTemplateColumns: `${String(splitPercent)}% ${String(DIVIDER_PX)}px minmax(0, 1fr)`,
    gridTemplateRows,
  }
}

/** Where the Inspector and Preview column sits in each preview layout. */
const RIGHT_COLUMN_CLASSES: Readonly<Record<PreviewLayout, string>> = {
  docked:
    'absolute top-16 right-4 z-20 w-[calc(100%-2rem)] max-h-[calc(100%-9rem)] overflow-y-auto md:w-80 md:max-h-[calc(100%-5rem)]',
  split: 'relative col-start-3 row-start-1 min-h-0 min-w-0 pt-16 pr-4 pb-4',
  full: 'absolute inset-x-4 top-16 bottom-4 z-20',
}

export function AppShell({
  canvas,
  blackboard,
  inspector,
  previewPanel,
  codePanel,
  headerActions,
}: AppShellProps) {
  const layout = useEditorStore((state) => effectivePreviewLayout(state.panels))
  const splitPercent = useEditorStore((state) => state.panels.splitPercent)
  const previewId = useId()
  const canvasCellRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const isPreviewFilling = layout !== 'docked'
  const isWide = useMediaQuery(WIDE_QUERY)
  const blackboardPanel = (
    <PanelFrame
      panel="blackboard"
      title="Blackboard"
      edge="left"
      isHidden={layout === 'full'}
      className={cn(
        'shrink-0',
        isWide && 'absolute top-16 left-4 z-20 w-60 max-h-[calc(100%-9rem)]',
      )}
      bodyClassName="overflow-y-auto"
    >
      {blackboard}
    </PanelFrame>
  )

  useFullPreviewFocus(layout, canvasCellRef, previewRef)

  return (
    <div className="relative h-dvh overflow-hidden">
      <SkipToCanvasLink />
      <AppHeader actions={headerActions} />
      <div className="absolute inset-0 grid" style={workspaceColumns(layout, splitPercent)}>
        <div
          ref={canvasCellRef}
          data-workspace-canvas
          inert={layout === 'full'}
          className="relative col-start-1 row-start-1 min-w-0 overflow-hidden"
        >
          {/* DOM order follows the reading order: Blackboard, canvas, Inspector, Preview, Code. */}
          {isWide && blackboardPanel}
          <main
            id={CANVAS_ID}
            aria-label="Node canvas"
            tabIndex={-1}
            data-focus-ring="inset"
            className="absolute inset-0"
          >
            {canvas}
          </main>
        </div>
        {layout === 'split' && <SplitDivider controlsId={previewId} />}
        <div ref={previewRef} className={cn('flex flex-col gap-2', RIGHT_COLUMN_CLASSES[layout])}>
          {/* A narrow screen has no room beside the canvas: every panel stacks in this column. */}
          {!isWide && blackboardPanel}
          <PanelFrame
            panel="inspector"
            title="Inspector"
            edge="right"
            isHidden={layout === 'full'}
            className="shrink-0"
            bodyClassName="max-h-60 overflow-y-auto"
          >
            {inspector}
          </PanelFrame>
          <div id={previewId} className={cn('flex min-h-0 flex-col', isPreviewFilling && 'flex-1')}>
            <PanelFrame
              panel="preview"
              title="Preview"
              regionLabel="Main preview"
              edge="right"
              headerActions={<PreviewLayoutPicker />}
              className={cn(isPreviewFilling && 'flex-1')}
              bodyClassName={cn(isPreviewFilling && 'flex flex-1 flex-col')}
            >
              {previewPanel}
            </PanelFrame>
          </div>
        </div>
        {/* Shares the canvas cell, pinned to its bottom edge, after the column in the tab order. */}
        <PanelFrame
          panel="code"
          title="Code"
          edge="bottom"
          isHidden={layout === 'full'}
          className={cn(
            'z-20 col-start-1 row-start-1 mr-4 mb-4 ml-16 self-end',
            layout === 'docked' && 'md:mr-[22rem]',
          )}
          bodyClassName="h-48 overflow-y-auto"
        >
          {codePanel}
        </PanelFrame>
      </div>
    </div>
  )
}

/** Parked above the viewport until focused, then it covers the wordmark slot. */
function SkipToCanvasLink() {
  return (
    <a
      href={`#${CANVAS_ID}`}
      className="absolute top-4 left-4 z-50 flex h-8 -translate-y-16 items-center bg-primary px-3 text-sm font-medium text-primary-foreground focus:translate-y-0"
    >
      Skip to canvas
    </a>
  )
}

interface AppHeaderProps {
  actions: ReactNode
}

function AppHeader({ actions }: AppHeaderProps) {
  return (
    // The header strip spans the viewport; only its blocks take pointer events so the canvas
    // underneath stays pannable through the empty middle.
    <header className="pointer-events-none absolute inset-x-4 top-4 z-30">
      <Cluster bg="accent" className="h-8 [&>:not([data-slot=cluster-filler])]:pointer-events-auto">
        <h1 className="flex items-center self-stretch bg-primary px-3 font-mono text-xs font-semibold tracking-[0.2em] text-primary-foreground uppercase">
          Nudo
        </h1>
        <Filler className="pointer-events-none invisible" />
        {actions}
        <ThemeToggle />
      </Cluster>
    </header>
  )
}

/**
 * APG toggle button: the name stays "Dark theme" and `aria-pressed` carries the state, so the
 * tooltip can describe the action without repeating the accessible name.
 */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="accent"
          size="icon-sm"
          aria-label="Dark theme"
          aria-pressed={isDark}
          onClick={toggleTheme}
        >
          {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </TooltipContent>
    </Tooltip>
  )
}
