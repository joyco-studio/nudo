import type { ReactNode } from 'react'
import { ReactFlowProvider } from '@xyflow/react'

import { AddNodeButton } from '@/features/add-node-menu/add-node-button'
import { AddNodeMenuProvider } from '@/features/add-node-menu/add-node-menu-provider'
import {
  AddPropertyMenuContainer,
  BlackboardContainer,
} from '@/features/blackboard/blackboard-container'
import { GraphCanvasContainer } from '@/features/canvas/graph-canvas-container'
import { CodePanelContainer } from '@/features/code-panel/code-panel-container'
import { CopyCodeButton } from '@/features/code-panel/copy-code-button'
import { CommandPaletteButton } from '@/features/command-palette/command-palette-button'
import { CommandPaletteProvider } from '@/features/command-palette/command-palette-provider'
import { ExamplesMenu } from '@/features/examples/examples-menu'
import { ExamplesProvider } from '@/features/examples/examples-provider'
import { InspectorContainer } from '@/features/inspector/inspector-container'
import { LanguageMenu } from '@/features/language/language-menu'
import { MainPreview } from '@/features/main-preview/main-preview'
import { NodePreviewSync } from '@/features/node-previews/node-preview-sync'
import { NewGraphButton } from '@/features/new-graph/new-graph-button'
import { NewGraphProvider } from '@/features/new-graph/new-graph-provider'
import { NoticeToaster } from '@/features/notice/notice-toaster'
import { usePanelShortcuts } from '@/features/panels/use-panel-shortcuts'
import { ShortcutsDialogProvider } from '@/features/shortcuts/shortcuts-dialog-provider'
import { useGlobalShortcuts } from '@/features/shortcuts/use-global-shortcuts'
import { I18nProvider } from '@/i18n/i18n-provider'
import { useLocale } from '@/i18n/use-t'
import { TooltipProvider } from '@/shared/ui/tooltip'

import { AppShell } from './app-shell'
import { ThemeProvider, useTheme } from './theme-provider'

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
      <ExamplesMenu />
      <AddNodeButton />
      <LanguageMenu />
    </>
  )
}

interface EditorCommandsProps {
  children: ReactNode
}

/** The command provider, handed the theme and language switches from the providers above it. */
function EditorCommands({ children }: EditorCommandsProps) {
  const { toggleTheme } = useTheme()
  const { setLocale } = useLocale()
  return (
    <CommandPaletteProvider toggleTheme={toggleTheme} setLocale={setLocale}>
      {children}
    </CommandPaletteProvider>
  )
}

export function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        {/* A tooltip is a label, not a surface: the pointer passes on to the control beneath it. */}
        <TooltipProvider disableHoverableContent>
          {/* One React Flow store for the canvas and the header, so the menu can place nodes. */}
          <ReactFlowProvider>
            <AddNodeMenuProvider>
              <ShortcutsDialogProvider>
                <NewGraphProvider>
                  <ExamplesProvider>
                    <EditorCommands>
                      <GlobalShortcuts />
                      <NodePreviewSync />
                      <NoticeToaster />
                      <AppShell
                        canvas={<GraphCanvasContainer />}
                        blackboard={<BlackboardContainer />}
                        blackboardActions={<AddPropertyMenuContainer />}
                        inspector={<InspectorContainer />}
                        previewPanel={<MainPreview />}
                        codePanel={<CodePanelContainer />}
                        codeActions={<CopyCodeButton />}
                        headerActions={<HeaderActions />}
                      />
                    </EditorCommands>
                  </ExamplesProvider>
                </NewGraphProvider>
              </ShortcutsDialogProvider>
            </AddNodeMenuProvider>
          </ReactFlowProvider>
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
