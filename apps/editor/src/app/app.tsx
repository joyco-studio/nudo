import { TooltipProvider } from '@/shared/ui/tooltip'

import { AppShell } from './app-shell'
import { ThemeProvider } from './theme-provider'

/** Placeholder until the node canvas lands: the dot grid it will draw on. */
function CanvasPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="size-full bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[20px_20px]"
    />
  )
}

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AppShell canvas={<CanvasPlaceholder />} previewPanel={null} headerActions={null} />
      </TooltipProvider>
    </ThemeProvider>
  )
}
