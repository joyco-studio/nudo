import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'

import { PanelFrame } from '@/features/panels/panel-frame'
import { FULL_PERCENT, effectivePreviewLayout } from '@/features/panels/panel-state'
import type { PreviewLayout } from '@/features/panels/panel-state'
import { PreviewLayoutPicker } from '@/features/panels/preview-layout-picker'
import { SplitHandle } from '@/features/panels/split-handle'
import { useFullPreviewFocus } from '@/features/panels/use-full-preview-focus'
import {
  CANVAS_PANEL_ID,
  PREVIEW_PANEL_ID,
  useSplitLayout,
} from '@/features/panels/use-split-layout'
import { IconSwap } from '@/shared/components/icon-swap'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Cluster, Filler } from '@/shared/ui/cluster'
import { ResizablePanel, ResizablePanelGroup } from '@/shared/ui/resizable'
import { Toggle } from '@/shared/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { GraphBreadcrumb } from './graph-breadcrumb'
import { useTheme } from './theme-provider'

/** Below this width the floating panels stack in one column instead of flanking the canvas. */
const WIDE_QUERY = '(min-width: 768px)'
/** The smallest grab area of the split handle, in pixels, for a mouse and for a finger. */
const SPLIT_HANDLE_TARGET = { fine: 12, coarse: 24 } as const

export interface AppShellProps {
  canvas: ReactNode
  blackboard: ReactNode
  inspector: ReactNode
  previewPanel: ReactNode
  codePanel: ReactNode
  headerActions: ReactNode
}

/**
 * Where the Inspector and Preview column sits in each preview layout. Docked and full, it floats
 * over the workspace (the preview panel itself has no width); in split it fills the preview
 * panel. On a narrow screen the docked column stops 12rem short of the bottom, clear of the
 * canvas zoom controls.
 */
const RIGHT_COLUMN_CLASSES: Readonly<Record<PreviewLayout, string>> = {
  docked:
    'absolute top-16 right-4 z-20 w-[calc(100%-2rem)] max-h-[calc(100%-12rem)] overflow-y-auto md:w-80 md:max-h-[calc(100%-5rem)]',
  split: 'relative size-full min-h-0 min-w-0 pt-16 pr-4 pb-4 pl-3',
  full: 'absolute inset-x-4 top-16 bottom-4 z-20',
}

/** The code drawer stays over the canvas: clear of the docked column, or of the split preview. */
function codePanelStyle(layout: PreviewLayout, splitPercent: number): CSSProperties | undefined {
  if (layout !== 'split') return undefined
  return { right: `calc(${String(FULL_PERCENT - splitPercent)}% + 1rem)` }
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
  const splitPercent = useEditorStore(
    (state) => state.splitDraftPercent ?? state.panels.splitPercent,
  )
  const canvasCellRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const isPreviewFilling = layout !== 'docked'
  const isWide = useMediaQuery(WIDE_QUERY)
  const split = useSplitLayout(layout === 'split')
  const blackboardPanel = (
    <PanelFrame
      panel="blackboard"
      title="Properties"
      description="Named values you can reuse and expose as uniforms"
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
      <ResizablePanelGroup
        groupRef={split.groupRef}
        defaultLayout={split.defaultLayout}
        onLayoutChange={split.onLayoutChange}
        onLayoutChanged={split.onLayoutChanged}
        resizeTargetMinimumSize={SPLIT_HANDLE_TARGET}
        className="absolute inset-0"
      >
        <ResizablePanel
          id={CANVAS_PANEL_ID}
          {...split.canvasLimits}
          // The canvas cell clips its own content; the panel must not scroll.
          style={{ overflow: 'hidden' }}
        >
          <div
            ref={canvasCellRef}
            data-workspace-canvas
            inert={layout === 'full'}
            className="relative size-full min-w-0 overflow-hidden"
          >
            {/* DOM order follows the reading order: Properties, canvas, Inspector, Preview, Code. */}
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
        </ResizablePanel>
        {layout === 'split' && <SplitHandle />}
        <ResizablePanel
          id={PREVIEW_PANEL_ID}
          {...split.previewLimits}
          // Docked and full, the column floats over the workspace from this zero-width panel.
          style={{ overflow: 'visible' }}
        >
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
            <div className={cn('flex min-h-0 flex-col', isPreviewFilling && 'flex-1')}>
              <PanelFrame
                panel="preview"
                title="Preview"
                regionLabel="Main preview"
                edge="right"
                headerActions={<PreviewLayoutPicker />}
                // Full covers the canvas: an opaque surface, so nothing ghosts through it.
                className={cn(isPreviewFilling && 'flex-1', layout === 'full' && 'bg-background')}
                bodyClassName={cn(isPreviewFilling && 'flex flex-1 flex-col')}
              >
                {previewPanel}
              </PanelFrame>
            </div>
          </div>
        </ResizablePanel>
        {/* Over the canvas, pinned to its bottom edge, after the column in the tab order. */}
        <PanelFrame
          panel="code"
          title="Code"
          edge="bottom"
          isHidden={layout === 'full'}
          className={cn(
            'absolute right-4 bottom-4 left-16 z-20',
            layout === 'docked' && 'md:right-[22rem]',
          )}
          style={codePanelStyle(layout, splitPercent)}
          bodyClassName="h-48 overflow-y-auto"
        >
          {codePanel}
        </PanelFrame>
      </ResizablePanelGroup>
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
        <GraphBreadcrumb />
        <Filler className="pointer-events-none invisible" />
        {actions}
        <ThemeToggle />
      </Cluster>
    </header>
  )
}

/**
 * APG toggle button (shadcn Toggle): the name stays "Dark theme" and `aria-pressed` carries the
 * state, so the tooltip can describe the action without repeating the accessible name.
 */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          aria-label="Dark theme"
          pressed={isDark}
          onPressedChange={toggleTheme}
          className="size-8 min-w-8 rounded-none bg-accent p-0 text-accent-foreground hover:bg-accent/80 hover:text-accent-foreground aria-pressed:bg-accent data-[state=on]:bg-accent"
        >
          <IconSwap swapKey={theme}>
            {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </IconSwap>
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </TooltipContent>
    </Tooltip>
  )
}
