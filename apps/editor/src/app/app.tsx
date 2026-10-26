import { GraphCanvasContainer } from '@/features/canvas/graph-canvas-container'
import { NoticeRegionContainer } from '@/features/notice/notice-region-container'
import { useGlobalShortcuts } from '@/features/shortcuts/use-global-shortcuts'
import { TooltipProvider } from '@/shared/ui/tooltip'

import { AppShell } from './app-shell'
import { ThemeProvider } from './theme-provider'

function Canvas() {
  return (
    <>
      <GraphCanvasContainer />
      <NoticeRegionContainer />
    </>
  )
}

export function App() {
  useGlobalShortcuts()

  return (
    <ThemeProvider>
      <TooltipProvider>
        <AppShell canvas={<Canvas />} previewPanel={null} headerActions={null} />
      </TooltipProvider>
    </ThemeProvider>
  )
}
