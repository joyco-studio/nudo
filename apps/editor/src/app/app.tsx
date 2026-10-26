import { ReactFlowProvider } from '@xyflow/react'

import { AddNodeButton } from '@/features/add-node-menu/add-node-button'
import { AddNodeMenuProvider } from '@/features/add-node-menu/add-node-menu-provider'
import { GraphCanvasContainer } from '@/features/canvas/graph-canvas-container'
import { MainPreview } from '@/features/main-preview/main-preview'
import { NoticeRegionContainer } from '@/features/notice/notice-region-container'
import { ShortcutsDialogProvider } from '@/features/shortcuts/shortcuts-dialog-provider'
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

/** Mounts the editor-wide shortcuts; they need the React Flow and shortcuts-dialog providers. */
function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {/* One React Flow store for the canvas and the header, so the menu can place nodes. */}
        <ReactFlowProvider>
          <AddNodeMenuProvider>
            <ShortcutsDialogProvider>
              <GlobalShortcuts />
              <AppShell
                canvas={<Canvas />}
                previewPanel={<MainPreview />}
                headerActions={<AddNodeButton />}
              />
            </ShortcutsDialogProvider>
          </AddNodeMenuProvider>
        </ReactFlowProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
