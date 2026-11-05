import { createContext, use } from 'react'

import type { AgentConfirmKind } from './confirm-broker'

/** The agent UI shared by the toolbar control, the activity panel and the dialogs. */
export interface AgentUi {
  readonly panelId: string
  readonly isPanelOpen: boolean
  /** Bumped each time the person opens the panel from the toolbar, so it takes focus then only. */
  readonly panelFocusRequest: number
  /** Registers the toolbar control (a callback ref); focus comes back to it from the panel. */
  readonly registerChip: (element: HTMLButtonElement | null) => void
  readonly togglePanel: () => void
  /** Collapses the panel and puts focus on the toolbar control. */
  readonly collapsePanel: () => void
  readonly openConnectDialog: () => void
  readonly confirm: (kind: AgentConfirmKind) => Promise<boolean>
}

export const AgentUiContext = createContext<AgentUi | null>(null)

export function useAgentUi(): AgentUi {
  const context = use(AgentUiContext)
  if (context === null) throw new Error('useAgentUi must be used inside <AgentUiProvider>.')
  return context
}
