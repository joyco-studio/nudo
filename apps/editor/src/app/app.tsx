import type { ReactNode } from 'react'
import { ReactFlowProvider } from '@xyflow/react'

import { AddNodeButton } from '@/features/add-node-menu/add-node-button'
import { AddNodeMenuProvider } from '@/features/add-node-menu/add-node-menu-provider'
import {
  AddPropertyMenuContainer,
  BlackboardContainer,
} from '@/features/blackboard/blackboard-container'
import { GraphCanvasContainer } from '@/features/canvas/graph-canvas-container'
import { CodePanel } from '@/features/code-panel/code-panel'
import { CommandPaletteButton } from '@/features/command-palette/command-palette-button'
import { CommandPaletteProvider } from '@/features/command-palette/command-palette-provider'
import { InspectorPanel } from '@/features/inspector/inspector-panel'
import { MainPreview } from '@/features/main-preview/main-preview'
import { NewGraphButton } from '@/features/new-graph/new-graph-button'
import { NewGraphProvider } from '@/features/new-graph/new-graph-provider'
import { NoticeRegionContainer } from '@/features/notice/notice-region-container'
import { usePanelShortcuts } from '@/features/panels/use-panel-shortcuts'
import { ShortcutsDialogProvider } from '@/features/shortcuts/shortcuts-dialog-provider'
import { useGlobalShortcuts } from '@/features/shortcuts/use-global-shortcuts'
import { TooltipProvider } from '@/shared/ui/tooltip'

import { AppShell } from './app-shell'
import { ThemeProvider, useTheme } from './theme-provider'

function Canvas() {
  return (
    <>
      <GraphCanvasContainer />
      <NoticeRegionContainer />
    </>
  )
}

/** Mounts the editor-wide and panel shortcuts; they run commands from the command provider. */
function GlobalShortcuts() {
  useGlobalShortcuts()
  usePanelShortcuts()
  return null
}

function HeaderActions() {
  return (
    <>
      <CommandPaletteButton />
      <NewGraphButton />
      <AddNodeButton />
    </>
  )
}

interface EditorCommandsProps {
  children: ReactNode
}

/** The command provider, handed the theme switch from the theme provider above it. */
function EditorCommands({ children }: EditorCommandsProps) {
  const { toggleTheme } = useTheme()
  return <CommandPaletteProvider toggleTheme={toggleTheme}>{children}</CommandPaletteProvider>
}

export function App() {
  return (
    <ThemeProvider>
      {/* A tooltip is a label, not a surface: the pointer passes on to the control beneath it. */}
      <TooltipProvider disableHoverableContent>
        {/* One React Flow store for the canvas and the header, so the menu can place nodes. */}
        <ReactFlowProvider>
          <AddNodeMenuProvider>
            <ShortcutsDialogProvider>
              <NewGraphProvider>
                <EditorCommands>
                  <GlobalShortcuts />
                  <AppShell
                    canvas={<Canvas />}
                    blackboard={<BlackboardContainer />}
                    blackboardActions={<AddPropertyMenuContainer />}
                    inspector={<InspectorPanel />}
                    previewPanel={<MainPreview />}
                    codePanel={<CodePanel />}
                    headerActions={<HeaderActions />}
                  />
                </EditorCommands>
              </NewGraphProvider>
            </ShortcutsDialogProvider>
          </AddNodeMenuProvider>
        </ReactFlowProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
