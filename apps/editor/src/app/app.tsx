import { ReactFlowProvider } from '@xyflow/react'

import { AddNodeButton } from '@/features/add-node-menu/add-node-button'
import { AddNodeMenuProvider } from '@/features/add-node-menu/add-node-menu-provider'
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
        {/* One React Flow store for the canvas and the header, so the menu can place nodes. */}
        <ReactFlowProvider>
          <AddNodeMenuProvider>
            <AppShell canvas={<Canvas />} previewPanel={null} headerActions={<AddNodeButton />} />
          </AddNodeMenuProvider>
        </ReactFlowProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
