import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useTidyUp } from '@/features/canvas/tidy-up/use-tidy-up'
import { useCurrentLocale } from '@/i18n/use-t'

import { clearPresenceWhenTaskEnds, createAgentSession } from './agent-session'
import { bridgeUrlFrom } from './agent-ui-model'
import { AgentUiProvider } from './agent-ui-provider'
import { createConfirmBroker } from './confirm-broker'

/** The MCP Worker's URL from the build env (`VITE_NUDO_MCP_URL`); null when it is not set. */
const BRIDGE_URL: string | null = bridgeUrlFrom(import.meta.env.VITE_NUDO_MCP_URL)

/** Keys stay in the browser; a blocked storage leaves the key alive only for this page load. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const values = new Map<string, string>()
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
  }
}

interface AgentBridgeMountProps {
  children: ReactNode
}

/**
 * Makes the agent feature live in this tab: the bridge to the MCP room (resumed on load when an
 * agent was paired before), the tool queue with tidy-up, confirmations, reduced motion and the UI
 * locale from the editor, and the agent UI state for the toolbar and the activity panel. Must sit
 * inside a `ReactFlowProvider` (tidy-up measures the nodes).
 */
export function AgentBridgeMount({ children }: AgentBridgeMountProps) {
  const tidy = useTidyUp()
  const locale = useCurrentLocale()
  const [confirmBroker] = useState(createConfirmBroker)
  const [session] = useState(() =>
    createAgentSession({
      url: BRIDGE_URL,
      storage: browserStorage() ?? memoryStorage(),
      // A fresh id per page load: the room tells this tab apart from others with the same key.
      tabId: crypto.randomUUID(),
      confirmBroker,
    }),
  )

  // Each tool call reads the services as the editor has them then.
  useEffect(() => {
    session.setServices({
      tidyUp: (commit) => {
        tidy('graph', { commit, keepView: true })
      },
      locale: () => locale,
    })
  }, [session, tidy, locale])

  useEffect(() => {
    const stopClearing = clearPresenceWhenTaskEnds()
    session.resume()
    return () => {
      stopClearing()
      session.dispose()
    }
  }, [session])

  return (
    <AgentUiProvider bridge={session} confirmBroker={confirmBroker}>
      {children}
    </AgentUiProvider>
  )
}
