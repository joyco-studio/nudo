import { PROTOCOL_VERSION, hashKey, parseRoomMessage } from '@nudo-tsl/agent-protocol'
import type {
  BridgeRequest,
  BridgeResponse,
  BrowserMessage,
  RoomMessage,
} from '@nudo-tsl/agent-protocol'

export type ConnectionStatus =
  'off' | 'connecting' | 'connected' | 'other-tab' | 'bad-key' | 'outdated' | 'unreachable'

/** The part of `WebSocket` the client uses, so tests can pass a small fake. */
export interface BridgeSocket {
  readonly readyState: number
  onopen: (() => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
}

export interface BridgeClientOptions {
  url: string
  key: string
  tabId: string
  socketFactory: (url: string) => BridgeSocket
  onRequest: (request: BridgeRequest) => Promise<BridgeResponse>
  onStatus: (status: ConnectionStatus) => void
}

export interface BridgeClient {
  start(): void
  stop(): void
  claimFocus(): void
}

const SOCKET_OPEN = 1
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const BACKOFF_FACTOR = 2

/**
 * Keeps one WebSocket to the MCP room alive: authenticates with the key, tells the editor which
 * tab is active, forwards agent requests to `onRequest` and reconnects with exponential backoff.
 * It knows nothing about React or the store; everything it uses is injected.
 */
export function createBridgeClient(options: BridgeClientOptions): BridgeClient {
  const { url, key, tabId, socketFactory, onRequest, onStatus } = options

  let socket: BridgeSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let backoffMs = INITIAL_BACKOFF_MS
  let running = false
  /** Bumped on every start and stop so a stale connection attempt can tell it was superseded. */
  let generation = 0
  let rejected = false
  let hashPromise: Promise<string> | null = null
  const getHash = (): Promise<string> => (hashPromise ??= hashKey(key))

  const send = (target: BridgeSocket, message: BrowserMessage): void => {
    if (target.readyState !== SOCKET_OPEN) return
    target.send(JSON.stringify(message))
  }

  const answerRequest = async (target: BridgeSocket, request: BridgeRequest): Promise<void> => {
    let response: BridgeResponse
    try {
      response = await onRequest(request)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The editor failed to handle the request.'
      response = {
        kind: 'response',
        id: request.id,
        ok: false,
        error: { code: 'invalid', message },
      }
    }
    send(target, response)
  }

  const handleRoomMessage = (target: BridgeSocket, message: RoomMessage): void => {
    switch (message.kind) {
      case 'welcome':
        backoffMs = INITIAL_BACKOFF_MS
        onStatus(message.activeTabId === tabId ? 'connected' : 'other-tab')
        return
      case 'active-tab':
        onStatus(message.activeTabId === tabId ? 'connected' : 'other-tab')
        return
      case 'rejected':
        rejected = true
        onStatus(message.reason === 'bad_key' ? 'bad-key' : 'outdated')
        return
      case 'request':
        void answerRequest(target, message)
        return
      case 'error':
        // The room refused a frame of ours; the connection is still good, so keep going.
        return
    }
  }

  const scheduleReconnect = (): void => {
    const delay = backoffMs
    backoffMs = Math.min(backoffMs * BACKOFF_FACTOR, MAX_BACKOFF_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, delay)
  }

  const connect = async (): Promise<void> => {
    const attempt = generation
    let hash: string
    try {
      hash = await getHash()
    } catch {
      if (attempt === generation) onStatus('unreachable')
      return
    }
    if (attempt !== generation) return

    let opened: BridgeSocket
    try {
      opened = socketFactory(`${url}/bridge/${hash}`)
    } catch {
      onStatus('unreachable')
      scheduleReconnect()
      return
    }
    socket = opened

    opened.onopen = () => {
      send(opened, { kind: 'hello', protocolVersion: PROTOCOL_VERSION, key, tabId })
    }
    opened.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return
      const parsed = parseRoomMessage(event.data)
      if (!parsed.ok) return
      handleRoomMessage(opened, parsed.value)
    }
    opened.onclose = () => {
      if (attempt !== generation) return
      socket = null
      if (rejected) return
      onStatus('unreachable')
      scheduleReconnect()
    }
  }

  const claimFocus = (): void => {
    if (socket === null) return
    send(socket, { kind: 'focus', tabId })
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer === null) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  return {
    start() {
      if (running) return
      running = true
      rejected = false
      backoffMs = INITIAL_BACKOFF_MS
      generation += 1
      window.addEventListener('focus', claimFocus)
      onStatus('connecting')
      void connect()
    },
    stop() {
      if (!running) return
      running = false
      generation += 1
      window.removeEventListener('focus', claimFocus)
      clearReconnectTimer()
      socket?.close()
      socket = null
      onStatus('off')
    },
    claimFocus,
  }
}
