import { loadKey, loadOrCreateKey, rotateKey } from './agent-key'
import type { KeyStorage } from './agent-key'
import type { BridgeClient } from './bridge-client'

export interface AgentBridgeOptions {
  /** The MCP Worker's base URL; null when this build has none configured. */
  url: string | null
  storage: KeyStorage
  /** Builds a client for `key` at `url` (the session wires the socket, the queue and the status). */
  createClient: (key: string, url: string) => BridgeClient
}

/** What the connect dialog needs from the bridge. */
export interface AgentBridgeHandle {
  readonly url: string | null
  readonly currentKey: () => string | null
  /** Creates the key on first use and starts the connection; the key, or null when unconfigured. */
  readonly connect: () => string | null
  /** Replaces the key and reconnects with it; the new key, or null when unconfigured. */
  readonly generateNewKey: () => string | null
}

export interface AgentBridge extends AgentBridgeHandle {
  /** Reconnects on page load, but only when the person paired an agent before. */
  readonly resume: () => void
  readonly dispose: () => void
}

/** Owns the pairing key and the one bridge client that uses it. Knows nothing about React. */
export function createAgentBridge({ url, storage, createClient }: AgentBridgeOptions): AgentBridge {
  let key: string | null = loadKey(storage)
  let client: BridgeClient | null = null

  const startWith = (baseUrl: string, nextKey: string): void => {
    client?.stop()
    key = nextKey
    client = createClient(nextKey, baseUrl)
    client.start()
  }

  return {
    url,
    currentKey: () => key,
    connect() {
      if (url === null) return null
      if (client !== null && key !== null) return key
      startWith(url, loadOrCreateKey(storage))
      return key
    },
    generateNewKey() {
      if (url === null) return null
      startWith(url, rotateKey(storage))
      return key
    },
    resume() {
      if (url === null || client !== null || key === null) return
      startWith(url, key)
    },
    dispose() {
      client?.stop()
      client = null
    },
  }
}
