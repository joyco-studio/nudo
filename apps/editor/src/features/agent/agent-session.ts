import type { Locale } from '@/i18n/locale'
import { DURATION_MS } from '@/shared/motion/tokens'
import { useEditorStore } from '@/store/editor-store'
import type { AgentPresence } from '@/store/store-types'

import { createAgentBridge } from './agent-bridge'
import type { AgentBridge } from './agent-bridge'
import type { KeyStorage } from './agent-key'
import { toSocketUrl } from './agent-ui-model'
import { createBridgeClient } from './bridge-client'
import type { BridgeSocket } from './bridge-client'
import { createChoreograph } from './choreography'
import type { ConfirmBroker } from './confirm-broker'
import { readTools } from './read-tools'
import { createRequestQueue } from './request-queue'
import { taskContextHooks, taskTools, toolGate } from './task-machine'
import type { CommitWrite } from './tool-context'
import { createWriteTools } from './write-tools'

/** What the session reads from the editor UI at the moment a tool needs it. */
export interface AgentSessionServices {
  /** Tidies the whole graph, committing through `commit`, without moving the view. */
  readonly tidyUp: (commit: CommitWrite) => void
  readonly locale: () => Locale
}

/** The bridge, plus a way for the mount to hand over the editor services as they change. */
export interface AgentSession extends AgentBridge {
  readonly setServices: (services: AgentSessionServices) => void
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The person's setting, read at call time; not the last input, since the agent's moves are not theirs. */
const prefersReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches

/** Until the mount hands over its services: tidy-up does nothing, templates open in English. */
const NO_SERVICES: AgentSessionServices = {
  tidyUp: () => undefined,
  locale: () => 'en',
}

export interface AgentSessionOptions {
  url: string | null
  storage: KeyStorage
  tabId: string
  confirmBroker: ConfirmBroker
  socketFactory?: (url: string) => BridgeSocket
}

const browserSocket = (url: string): BridgeSocket => new WebSocket(toSocketUrl(url))

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const getStore = () => useEditorStore.getState()

/** Agent presence only shows while a task is active; a late publish after Stop is dropped. */
function setPresenceWhileActive(presence: AgentPresence | null): void {
  const store = getStore()
  if (presence !== null && store.agentTask?.status !== 'active') return
  store.setAgentPresence(presence)
}

/**
 * Clears the agent cursor, ghost and wire once the task stops or finishes, so they leave the
 * canvas with it. Returns the unsubscribe.
 */
export function clearPresenceWhenTaskEnds(): () => void {
  return useEditorStore.subscribe((state, previous) => {
    if (state.agentTask === previous.agentTask) return
    const wasActive = previous.agentTask?.status === 'active'
    const isActive = state.agentTask?.status === 'active'
    if (wasActive && !isActive && state.agentPresence !== null) state.setAgentPresence(null)
  })
}

/**
 * Wires one editor tab to the MCP room: the key and client (`createAgentBridge`), the queue that
 * runs every tool behind the task machine's gate, and the choreography on the canvas.
 */
export function createAgentSession(options: AgentSessionOptions): AgentSession {
  const { url, storage, tabId, confirmBroker } = options
  let services = NO_SERVICES
  const choreograph = createChoreograph({
    reducedMotion: prefersReducedMotion,
    travelMs: DURATION_MS.slow,
    setPresence: setPresenceWhileActive,
    wait,
  })
  const handleRequest = createRequestQueue(
    { ...readTools, ...createWriteTools(() => services.locale()), ...taskTools },
    {
      ...taskContextHooks,
      choreograph,
      tidyUp: (commit) => {
        services.tidyUp(commit)
        return Promise.resolve()
      },
      confirm: (kind, signal) => confirmBroker.request(kind, signal),
    },
    toolGate,
  )

  const bridge = createAgentBridge({
    url,
    storage,
    createClient: (key, baseUrl) =>
      createBridgeClient({
        url: baseUrl,
        key,
        tabId,
        socketFactory: options.socketFactory ?? browserSocket,
        onRequest: handleRequest,
        onStatus: (status) => {
          getStore().setAgentConnection(status)
        },
      }),
  })

  return {
    ...bridge,
    setServices: (next) => {
      services = next
    },
  }
}
