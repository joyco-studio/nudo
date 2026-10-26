import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Moon, PanelRightClose, PanelRightOpen, Sun } from 'lucide-react'

import { CANVAS_ID } from '@/shared/lib/landmarks'
import { Button } from '@/shared/ui/button'
import { Cluster, Filler } from '@/shared/ui/cluster'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useTheme } from './theme-provider'

export interface AppShellProps {
  canvas: ReactNode
  previewPanel: ReactNode
  headerActions: ReactNode
}

export function AppShell({ canvas, previewPanel, headerActions }: AppShellProps) {
  return (
    <div className="relative h-dvh overflow-hidden">
      <SkipToCanvasLink />
      <AppHeader actions={headerActions} />
      <main
        id={CANVAS_ID}
        aria-label="Node canvas"
        tabIndex={-1}
        data-focus-ring="inset"
        className="absolute inset-0"
      >
        {canvas}
      </main>
      <PreviewPanel>{previewPanel}</PreviewPanel>
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

interface PreviewPanelProps {
  children: ReactNode
}

function PreviewPanel({ children }: PreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const bodyId = useId()
  const toggleHint = isExpanded ? 'Collapse preview' : 'Expand preview'

  return (
    <section
      aria-label="Main preview"
      className="absolute top-16 right-4 z-20 flex w-[min(20rem,calc(100%-2rem))] flex-col border bg-background/85 backdrop-blur-md"
    >
      <div className="flex h-8 items-center gap-2 bg-muted/50 pl-3">
        <h2 className="flex-1 font-heading text-sm font-semibold tracking-wide uppercase">
          Preview
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Preview panel"
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              onClick={() => {
                setIsExpanded((expanded) => !expanded)
              }}
            >
              {isExpanded ? (
                <PanelRightClose aria-hidden="true" />
              ) : (
                <PanelRightOpen aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{toggleHint}</TooltipContent>
        </Tooltip>
      </div>
      <div id={bodyId} hidden={!isExpanded} className="border-t">
        {children}
      </div>
    </section>
  )
}
